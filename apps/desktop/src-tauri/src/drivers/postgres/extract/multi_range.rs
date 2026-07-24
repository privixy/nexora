use serde_json::Value as JsonValue;
use tokio_postgres::types::Type;

use crate::drivers::postgres::extract::common::advance_buf;

#[inline]
pub fn extract_or_null(ty: &Type, buf: &mut &[u8]) -> JsonValue {
    if buf.len() < 4 {
        return JsonValue::Null;
    };

    let count = u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]);

    *buf = &buf[4..];

    if count == 0 {
        return JsonValue::from("{}");
    };

    let mut ranges = String::from('{');

    for _ in 0..count - 1 {
        // skip range length
        if advance_buf(buf, 4).is_err() {
            ranges.push('}');
            return JsonValue::String(ranges);
        };

        match super::range::extract_or_null(ty, buf) {
            JsonValue::String(r) => ranges.push_str(&r),
            r => {
                log::error!("range::extract_or_null must return a string or null");
                ranges.push_str(&r.to_string())
            }
        }

        ranges.push(',');
    }

    // skip range length
    if advance_buf(buf, 4).is_err() {
        ranges.push('}');
        return JsonValue::String(ranges);
    };

    match super::range::extract_or_null(ty, buf) {
        JsonValue::String(r) => ranges.push_str(&r),
        r => {
            log::error!("range::extract_or_null must return a string or null");
            ranges.push_str(&r.to_string())
        }
    };

    ranges.push('}');

    JsonValue::String(ranges)
}

#[cfg(test)]
mod tests;
