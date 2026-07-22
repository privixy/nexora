use super::*;

#[test]
fn parses_postgres_authority() {
    let e = parse("jdbc:postgresql://db.example.com:6543/mydb", "postgresql").unwrap();
    assert_eq!(e.host, "db.example.com");
    assert_eq!(e.port, Some(6543));
    assert_eq!(e.database, "mydb");
}

#[test]
fn parses_mysql_without_port() {
    let e = parse("jdbc:mysql://localhost/app", "mysql").unwrap();
    assert_eq!(e.host, "localhost");
    assert_eq!(e.port, None);
    assert_eq!(e.database, "app");
}

#[test]
fn strips_userinfo_and_query() {
    let e = parse("jdbc:mysql://user:pw@host:3306/db?useSSL=true", "mysql").unwrap();
    assert_eq!(e.host, "host");
    assert_eq!(e.port, Some(3306));
    assert_eq!(e.database, "db");
}

#[test]
fn parses_sqlserver_with_props() {
    let e = parse("jdbc:sqlserver://host:1433;databaseName=sales", "sqlserver").unwrap();
    assert_eq!(e.host, "host");
    assert_eq!(e.port, Some(1433));
    assert_eq!(e.database, "sales");
}

#[test]
fn parses_sqlite_file() {
    let e = parse("jdbc:sqlite:/data/app.db", "sqlite").unwrap();
    assert_eq!(e.host, "");
    assert_eq!(e.database, "/data/app.db");
}

#[test]
fn subprotocol_extraction() {
    assert_eq!(subprotocol("jdbc:postgresql://x"), "postgresql");
    assert_eq!(subprotocol("not-jdbc"), "");
}
