use super::*;

mod format_table_ref_tests {
    use super::*;

    #[test]
    fn mysql_uses_backticks_no_schema() {
        assert_eq!(format_table_ref("mysql", "mydb", "users"), "`users`");
    }

    #[test]
    fn postgres_uses_double_quotes_with_schema() {
        assert_eq!(
            format_table_ref("postgres", "public", "users"),
            r#""public"."users""#
        );
    }

    #[test]
    fn postgres_preserves_custom_schema() {
        assert_eq!(
            format_table_ref("postgres", "myschema", "orders"),
            r#""myschema"."orders""#
        );
    }

    #[test]
    fn sqlite_uses_double_quotes_no_schema() {
        assert_eq!(format_table_ref("sqlite", "", "products"), r#""products""#);
    }

    #[test]
    fn unknown_driver_uses_double_quotes() {
        assert_eq!(format_table_ref("unknown", "", "t"), r#""t""#);
    }
}

mod drop_table_if_exists_tests {
    use super::*;

    #[test]
    fn mysql_statement() {
        assert_eq!(
            drop_table_if_exists("mysql", "", "users"),
            "DROP TABLE IF EXISTS `users`;"
        );
    }

    #[test]
    fn postgres_statement_with_schema() {
        assert_eq!(
            drop_table_if_exists("postgres", "public", "users"),
            r#"DROP TABLE IF EXISTS "public"."users";"#
        );
    }

    #[test]
    fn sqlite_statement() {
        assert_eq!(
            drop_table_if_exists("sqlite", "", "users"),
            r#"DROP TABLE IF EXISTS "users";"#
        );
    }
}

mod insert_into_statement_tests {
    use super::*;

    #[test]
    fn mysql_statement() {
        assert_eq!(
            insert_into_statement("mysql", "", "users", "(1, 'Alice')"),
            "INSERT INTO `users` VALUES (1, 'Alice');"
        );
    }

    #[test]
    fn postgres_statement_with_schema() {
        assert_eq!(
            insert_into_statement("postgres", "public", "users", "(1, 'Alice')"),
            r#"INSERT INTO "public"."users" VALUES (1, 'Alice');"#
        );
    }

    #[test]
    fn sqlite_statement() {
        assert_eq!(
            insert_into_statement("sqlite", "", "users", "(1, 'Alice')"),
            r#"INSERT INTO "users" VALUES (1, 'Alice');"#
        );
    }

    #[test]
    fn postgres_multiple_rows() {
        assert_eq!(
            insert_into_statement("postgres", "app", "orders", "(1, 100), (2, 200)"),
            r#"INSERT INTO "app"."orders" VALUES (1, 100), (2, 200);"#
        );
    }
}
