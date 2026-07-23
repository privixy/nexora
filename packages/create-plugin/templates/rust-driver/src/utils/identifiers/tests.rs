use super::quote_identifier;

#[test]
fn quotes_plain_names() {
    assert_eq!(quote_identifier("users", '"'), "\"users\"");
    assert_eq!(quote_identifier("users", '`'), "`users`");
}

#[test]
fn escapes_embedded_quotes() {
    assert_eq!(quote_identifier("a\"b", '"'), "\"a\"\"b\"");
    assert_eq!(quote_identifier("a`b", '`'), "`a``b`");
}

#[test]
fn handles_empty() {
    assert_eq!(quote_identifier("", '"'), "\"\"");
}
