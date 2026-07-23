use serde_json::Value as JsonValue;
use tokio_postgres::types::{Kind, Type};

use super::common::split_at_value_len;

pub fn extract_or_null(ty: &Type, buf: &mut &[u8]) -> JsonValue {
    // array must be at least 12 bytes (header) except if it is `NULL`
    if buf.is_empty() {
        return JsonValue::Null;
    };

    if buf.len() < 12 {
        log::error!("array buffer too short: {}", buf.len());
        return JsonValue::Null;
    };

    let dimensions = i32::from_be_bytes(buf[..4].try_into().unwrap());

    // this means empty array
    if dimensions < 1 {
        return JsonValue::Array(vec![]);
    };

    // max dimensions is 64 and just for safety
    if dimensions > 64 {
        log::error!("too many dimensions: {}", dimensions);
        return JsonValue::Null;
    }

    // ignore `has nulls` 4 bytes
    // ignore `element type` 4 bytes because we already have it
    *buf = &buf[12..];

    let dimensions = dimensions as usize;

    // each dimension must have at least 8 bytes info
    if buf.len() < 8 * dimensions {
        log::error!("array buffer too short: {}", buf.len());
        return JsonValue::Null;
    };

    let mut total_vecs: usize = 1;
    let mut arr_lengths = Vec::with_capacity(dimensions);

    for i in 0..dimensions {
        let length = i32::from_be_bytes(buf[..4].try_into().unwrap());

        // i don't think this is possible but just in case
        if length < 0 {
            log::error!("invalid length: {}", length);
            return JsonValue::Null;
        };

        let length = length as usize;

        arr_lengths.push(length);

        *buf = &buf[8..]; // skip `lower bound` 4 bytes

        if dimensions - i == 1 {
            continue;
        };

        let all_vecs_in_this_lvl = match total_vecs.checked_mul(length) {
            Some(v) => v,
            None => {
                log::error!("overflow: total_vecs={} length={}", total_vecs, length);
                return JsonValue::Null;
            }
        };

        total_vecs = match total_vecs.checked_add(all_vecs_in_this_lvl) {
            Some(v) => v,
            None => {
                log::error!(
                    "overflow: total_vecs={} all_vecs_in_this_lvl={}",
                    total_vecs,
                    all_vecs_in_this_lvl
                );
                return JsonValue::Null;
            }
        };
    }

    // SAFETY: i think this number should be discussed
    if total_vecs > 1024 {
        log::error!("too many vectors: total_vecs={}", total_vecs);
        return JsonValue::Null;
    };

    let mut vec = Vec::with_capacity(arr_lengths[0]);

    let _ = extract_recursively_or_fill_nulls_into(&mut vec, &arr_lengths, 1, ty, buf);

    JsonValue::Array(vec)
}

/// the idea of returning a `Result` is to stop extracting further if error occurs
/// because it is most likely to fail anyway
fn extract_recursively_or_fill_nulls_into(
    vec: &mut Vec<JsonValue>,
    arr_lengths: &[usize],
    depth: usize,
    ty: &Type,
    buf: &mut &[u8],
) -> Result<(), ()> {
    match depth == arr_lengths.len() {
        true => {
            let len = arr_lengths[depth - 1];
            for i in 0..len {
                match try_extract_elem(ty, buf) {
                    Ok(value) => vec.push(value),
                    Err(_) => {
                        fill_nulls(vec, len - i);
                        return Err(());
                    }
                }
            }
        }

        false => {
            let len = arr_lengths[depth - 1];
            for i in 0..len {
                let mut sub_vec = Vec::with_capacity(len);
                if extract_recursively_or_fill_nulls_into(
                    &mut sub_vec,
                    arr_lengths,
                    depth + 1,
                    ty,
                    buf,
                )
                .is_err()
                {
                    vec.push(JsonValue::Array(sub_vec));
                    fill_nulls(vec, len - 1 - i);
                    return Err(());
                }
                vec.push(JsonValue::Array(sub_vec));
            }
        }
    };

    Ok(())
}

#[inline(always)]
fn fill_nulls(vec: &mut Vec<JsonValue>, count: usize) {
    for _ in 0..count {
        vec.push(JsonValue::Null);
    }
}

#[inline]
fn try_extract_elem(ty: &Type, buf: &mut &[u8]) -> Result<JsonValue, ()> {
    let mut value_buf = match split_at_value_len(buf)? {
        Some(buf) => buf,
        None => return Ok(JsonValue::Null),
    };

    Ok(match ty.kind() {
        Kind::Simple => super::simple::extract_or_null(ty, value_buf),
        Kind::Enum(_variants) => super::r#enum::extract_or_null(value_buf),
        Kind::Array(_) => JsonValue::Null, // impossible case
        Kind::Range(ty) => super::range::extract_or_null(ty, &mut value_buf),
        Kind::Multirange(ty) => super::multi_range::extract_or_null(ty, &mut value_buf),
        Kind::Domain(inner) => super::simple::extract_or_null(inner, value_buf),
        Kind::Composite(fields) => super::composite::extract_or_null(fields, &mut value_buf),
        _ => JsonValue::Null,
    })
}

#[cfg(test)]
mod tests;
