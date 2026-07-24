#[allow(unused_imports)]
use super::*;

#[test]
fn test_simple_1d_pg_array_extraction() {
    let arr = [
        0, 0, 0, 1, // dimenstions 1
        0, 0, 0, 0, // has nulls 0: false, 1: true
        0, 0, 0, 17, // oid 17 = INT4
        0, 0, 0, 3, // array length
        0, 0, 0, 1, // lower bound
        // the following is a sequance of element length and element bytes
        0, 0, 0, 4, // length 4 bytes
        0, 0, 0, 1, // element
        0, 0, 0, 4, // length
        0, 0, 0, 2, // element
        0, 0, 0, 4, // length
        0, 0, 0, 3, // element
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(
        json,
        JsonValue::Array(vec![
            JsonValue::Number(1.into()),
            JsonValue::Number(2.into()),
            JsonValue::Number(3.into())
        ])
    );
}

#[test]
fn test_simple_2dim_pg_array_extraction() {
    let arr = [
        0, 0, 0, 2, // dimensions 2
        0, 0, 0, 0, // has nulls 0: false, 1: true
        0, 0, 0, 17, // oid 17 = INT4
        0, 0, 0, 2, // outer array length: we have 2 sub arrays
        0, 0, 0, 1, // lower bound
        0, 0, 0, 2, // inner array lengths: each sub array has 2 elements
        0, 0, 0, 1, // lower bound
        // the following is a sequance of element length and element bytes for each array
        // beginning of first array
        0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 2,
        // end of first array
        // beginning of second array
        0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4,
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(
        json,
        JsonValue::Array(vec![
            JsonValue::Array(vec![
                JsonValue::Number(1.into()),
                JsonValue::Number(2.into()),
            ]),
            JsonValue::Array(vec![
                JsonValue::Number(3.into()),
                JsonValue::Number(4.into()),
            ]),
        ])
    );
}

#[test]
fn test_simple_3dim_pg_array_extraction() {
    let arr = [
        0, 0, 0, 3, // dimensions: 3 dimensions
        0, 0, 0, 0, // has nulls 0: false, 1: true
        0, 0, 0, 17, // oid 17 = INT4
        0, 0, 0, 2, // main array length: we have 2 sub arrays
        0, 0, 0, 1, // lower bound
        0, 0, 0, 2, // level 1 array lengths: each level 1 array has 2 elements
        0, 0, 0, 1, // lower bound
        0, 0, 0, 2, // level 2 array lengths: each level 2 array has 2 elements
        0, 0, 0, 1, // lower bound
        // beginning of (level 1 first array -> level 2 first array)
        0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 2,
        // end
        // beginning of (level 1 first array -> level 2 second array)
        0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4,
        // beginning of (level 1 second array -> level 2 first array)
        0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 2,
        // end
        // beginning of (level 1 second array -> level 2 second array)
        0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4,
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(
        json,
        JsonValue::Array(vec![
            JsonValue::Array(vec![
                JsonValue::Array(vec![
                    JsonValue::Number(1.into()),
                    JsonValue::Number(2.into()),
                ]),
                JsonValue::Array(vec![
                    JsonValue::Number(3.into()),
                    JsonValue::Number(4.into()),
                ]),
            ]),
            JsonValue::Array(vec![
                JsonValue::Array(vec![
                    JsonValue::Number(1.into()),
                    JsonValue::Number(2.into()),
                ]),
                JsonValue::Array(vec![
                    JsonValue::Number(3.into()),
                    JsonValue::Number(4.into()),
                ]),
            ])
        ])
    );
}

#[test]
fn test_empty_1d_array() {
    // 1 dimension, INT4, length 0
    let arr = [
        0, 0, 0, 1, // dimensions 1
        0, 0, 0, 0, // has nulls false
        0, 0, 0, 17, // oid INT4
        0, 0, 0, 0, // array length 0
        0, 0, 0, 1, // lower bound
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(json, JsonValue::Array(vec![]));
}

#[test]
fn test_single_element_array() {
    let arr = [
        0, 0, 0, 1, // dimensions 1
        0, 0, 0, 0, // has nulls false
        0, 0, 0, 17, // oid INT4
        0, 0, 0, 1, // array length 1
        0, 0, 0, 1, // lower bound
        0, 0, 0, 4, // value length 4
        0, 0, 0, 99, // element 99
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(json, JsonValue::Array(vec![JsonValue::Number(99.into())]));
}

#[test]
fn test_1d_text_array() {
    // 1D array of TEXT (oid 25) with 2 elements: "hello", "world"
    let arr = [
        0, 0, 0, 1, // dimensions 1
        0, 0, 0, 0, // has nulls false
        0, 0, 0, 25, // oid TEXT
        0, 0, 0, 2, // array length 2
        0, 0, 0, 1, // lower bound
        // element 1: "hello"
        0, 0, 0, 5, // length 5
        b'h', b'e', b'l', b'l', b'o', // element 2: "world"
        0, 0, 0, 5, // length 5
        b'w', b'o', b'r', b'l', b'd',
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::TEXT, &mut buf);
    assert_eq!(
        json,
        JsonValue::Array(vec![
            JsonValue::String("hello".to_string()),
            JsonValue::String("world".to_string()),
        ])
    );
}

#[test]
fn test_empty_buffer_returns_null() {
    let mut buf = &[][..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(json, JsonValue::Null);
}

#[test]
fn test_truncated_header_returns_null() {
    // only 4 bytes — not enough for the 12-byte header
    let arr = [0, 0, 0, 1];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(json, JsonValue::Null);
}

#[test]
fn test_zero_dimensions_returns_empty_array() {
    let arr = [
        0, 0, 0, 0, // dimensions 0 — invalid
        0, 0, 0, 0, 0, 0, 0, 17,
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(json, JsonValue::Array(vec![]));
}

#[test]
fn test_negative_length_returns_null_with_partial_fill() {
    // 1D array with 2 elements where first has invalid (negative) length
    let arr = [
        0, 0, 0, 1, // dimensions 1
        0, 0, 0, 0, // has nulls false
        0, 0, 0, 17, // oid INT4
        0, 0, 0, 2, // array length 2
        0, 0, 0, 1, // lower bound
        // element 1: negative length = NULL
        0xff, 0xff, 0xff, 0xff, // length -1 (NULL marker)
        // element 2: normal
        0, 0, 0, 4, 0, 0, 0, 42,
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(
        json,
        JsonValue::Array(vec![JsonValue::Null, JsonValue::Number(42.into()),])
    );
}

#[test]
fn test_2d_empty_inner_arrays() {
    // 2 dimensions, outer length 2, each inner length 0
    let arr = [
        0, 0, 0, 2, // dimensions 2
        0, 0, 0, 0, // has nulls false
        0, 0, 0, 17, // oid INT4
        0, 0, 0, 2, // outer length 2
        0, 0, 0, 1, // lower bound
        0, 0, 0, 0, // inner length 0 (each sub-array has 0 elements)
        0, 0, 0, 1, // lower bound
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(
        json,
        JsonValue::Array(vec![JsonValue::Array(vec![]), JsonValue::Array(vec![]),])
    );
}

#[test]
fn test_truncated_elements_fill_with_nulls() {
    // 1D array length 3, but only 1 complete element provided
    let arr = [
        0, 0, 0, 1, // dimensions 1
        0, 0, 0, 0, // has nulls false
        0, 0, 0, 17, // oid INT4
        0, 0, 0, 3, // array length 3
        0, 0, 0, 1, // lower bound
        // element 1: valid
        0, 0, 0, 4, 0, 0, 0, 10,
        // element 2: truncated — only 2 bytes of value instead of 4
        0, 0, 0, 4, // length says 4...
        0, 0, // ...but only 2 bytes available
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::INT4, &mut buf);
    assert_eq!(
        json,
        JsonValue::Array(vec![
            JsonValue::Number(10.into()),
            JsonValue::Null,
            JsonValue::Null,
        ])
    );
}

#[test]
fn test_bool_array() {
    // 1D array of BOOL (oid 16) with 3 elements: true, false, true
    let arr = [
        0, 0, 0, 1, // dimensions 1
        0, 0, 0, 0, // has nulls false
        0, 0, 0, 16, // oid BOOL
        0, 0, 0, 3, // array length 3
        0, 0, 0, 1, // lower bound
        0, 0, 0, 1, 1, // length 1, value true
        0, 0, 0, 1, 0, // length 1, value false
        0, 0, 0, 1, 1, // length 1, value true
    ];
    let mut buf = &arr[..];
    let json = extract_or_null(&Type::BOOL, &mut buf);
    assert_eq!(
        json,
        JsonValue::Array(vec![
            JsonValue::Bool(true),
            JsonValue::Bool(false),
            JsonValue::Bool(true),
        ])
    );
}
