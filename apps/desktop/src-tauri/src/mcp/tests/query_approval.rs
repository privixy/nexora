use super::super::router::APPROVAL_POLL_INTERVAL_MS;

#[test]
fn approval_poll_interval_is_preserved() {
    assert_eq!(APPROVAL_POLL_INTERVAL_MS, 500);
}
