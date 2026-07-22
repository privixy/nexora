use super::*;

// postgres range flags
const RANGE_EMPTY: u8 = 1 << 0;
const RANGE_LB_INC: u8 = 1 << 1;
const RANGE_UB_INC: u8 = 1 << 2;
const RANGE_LB_INF: u8 = 1 << 3;
const RANGE_UB_INF: u8 = 1 << 4;

fn build_int4_range(flag: u8, lower: Option<i32>, upper: Option<i32>) -> Vec<u8> {
    let mut buf = vec![flag];
    if let Some(v) = lower {
        buf.extend_from_slice(&4i32.to_be_bytes());
        buf.extend_from_slice(&v.to_be_bytes());
    }
    if let Some(v) = upper {
        buf.extend_from_slice(&4i32.to_be_bytes());
        buf.extend_from_slice(&v.to_be_bytes());
    }
    buf
}

#[test]
fn test_empty_range() {
    let buf = [RANGE_EMPTY];
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("empty".to_string())
    );
}

#[test]
fn test_inclusive_exclusive() {
    // [1, 5)
    let buf = build_int4_range(RANGE_LB_INC, Some(1), Some(5));
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("[1, 5)".to_string())
    );
}

#[test]
fn test_inclusive_inclusive() {
    // [1, 5]
    let buf = build_int4_range(RANGE_LB_INC | RANGE_UB_INC, Some(1), Some(5));
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("[1, 5]".to_string())
    );
}

#[test]
fn test_exclusive_exclusive() {
    // (1, 5)
    let buf = build_int4_range(0x00, Some(1), Some(5));
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("(1, 5)".to_string())
    );
}

#[test]
fn test_exclusive_inclusive() {
    // (1, 5]
    let buf = build_int4_range(RANGE_UB_INC, Some(1), Some(5));
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("(1, 5]".to_string())
    );
}

#[test]
fn test_unbounded_lower_inclusive_upper() {
    // (, 5]
    let buf = build_int4_range(RANGE_LB_INF | RANGE_UB_INC, None, Some(5));
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("(, 5]".to_string())
    );
}

#[test]
fn test_unbounded_lower_exclusive_upper() {
    // (, 5)
    let buf = build_int4_range(RANGE_LB_INF, None, Some(5));
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("(, 5)".to_string())
    );
}

#[test]
fn test_inclusive_lower_unbounded_upper() {
    // [5, )
    let buf = build_int4_range(RANGE_LB_INC | RANGE_UB_INF, Some(5), None);
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("[5, )".to_string())
    );
}

#[test]
fn test_exclusive_lower_unbounded_upper() {
    // (5, )
    let buf = build_int4_range(RANGE_UB_INF, Some(5), None);
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("(5, )".to_string())
    );
}

#[test]
fn test_both_unbounded() {
    // (, )
    let buf = build_int4_range(RANGE_LB_INF | RANGE_UB_INF, None, None);
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("(, )".to_string())
    );
}

#[test]
fn test_empty_buffer_returns_null() {
    let buf = [];
    let mut slice = &buf[..];
    assert_eq!(extract_or_null(&Type::INT4, &mut slice), JsonValue::Null);
}

#[test]
fn test_negative_values() {
    // [-10, 0)
    let buf = build_int4_range(RANGE_LB_INC, Some(-10), Some(0));
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("[-10, 0)".to_string())
    );
}

#[test]
fn test_point_range() {
    // [42, 42]
    let buf = build_int4_range(RANGE_LB_INC | RANGE_UB_INC, Some(42), Some(42));
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("[42, 42]".to_string())
    );
}

#[test]
fn test_truncated_upper_returns_null_upper() {
    // valid lower but no upper data
    let buf = build_int4_range(RANGE_LB_INC, Some(1), None);
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("[1, null)".to_string())
    );
}

#[test]
fn test_truncated_lower_returns_null_both() {
    // flag + lower len says 4 bytes but only 2 available
    let buf = [RANGE_LB_INC, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00];
    let mut slice = &buf[..];
    assert_eq!(
        extract_or_null(&Type::INT4, &mut slice),
        JsonValue::String("[null, null)".to_string())
    );
}
