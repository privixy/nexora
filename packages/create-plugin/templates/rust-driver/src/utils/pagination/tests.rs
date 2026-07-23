use super::paginate;

#[test]
fn first_page() {
    assert_eq!(paginate("SELECT 1", 1, 100), "SELECT 1 LIMIT 100 OFFSET 0");
}

#[test]
fn later_page() {
    assert_eq!(paginate("SELECT 1", 3, 25), "SELECT 1 LIMIT 25 OFFSET 50");
}

#[test]
fn page_zero_treated_as_one() {
    assert_eq!(paginate("SELECT 1", 0, 10), "SELECT 1 LIMIT 10 OFFSET 0");
}
