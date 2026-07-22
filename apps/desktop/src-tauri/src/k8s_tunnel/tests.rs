use super::*;

mod build_tunnel_key_tests {
    use super::*;

    #[test]
    fn test_basic_key_format() {
        let key = build_tunnel_key("my-cluster", "default", "service", "my-db", 3306);
        assert_eq!(key, "my-cluster:default:service/my-db:3306");
    }

    #[test]
    fn test_pod_resource_type() {
        let key = build_tunnel_key("prod-cluster", "database", "pod", "mysql-0", 5432);
        assert_eq!(key, "prod-cluster:database:pod/mysql-0:5432");
    }

    #[test]
    fn test_empty_context() {
        let key = build_tunnel_key("", "default", "service", "db", 80);
        assert_eq!(key, ":default:service/db:80");
    }

    #[test]
    fn test_special_characters() {
        let key = build_tunnel_key(
            "gke_project_us-central1_cluster",
            "my-namespace",
            "service",
            "my-db-svc",
            3306,
        );
        assert_eq!(
            key,
            "gke_project_us-central1_cluster:my-namespace:service/my-db-svc:3306"
        );
    }
}

mod parse_lines_tests {
    use super::*;

    #[test]
    fn test_basic_lines() {
        let output = "line1\nline2\nline3\n";
        let result = parse_lines(output);
        assert_eq!(result, vec!["line1", "line2", "line3"]);
    }

    #[test]
    fn test_empty_output() {
        let result = parse_lines("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_whitespace_handling() {
        let output = "  line1  \n\n  line2  \n";
        let result = parse_lines(output);
        assert_eq!(result, vec!["line1", "line2"]);
    }
}

mod parse_lines_with_prefix_tests {
    use super::*;

    #[test]
    fn test_namespace_prefix() {
        let output = "namespace/default\nnamespace/kube-system\nnamespace/my-ns\n";
        let result = parse_lines_with_prefix(output, "namespace/");
        assert_eq!(result, vec!["default", "kube-system", "my-ns"]);
    }

    #[test]
    fn test_service_prefix() {
        let output = "service/my-db\nservice/api-gateway\n";
        let result = parse_lines_with_prefix(output, "service/");
        assert_eq!(result, vec!["my-db", "api-gateway"]);
    }

    #[test]
    fn test_pod_prefix() {
        let output = "pod/mysql-0\npod/mysql-1\n";
        let result = parse_lines_with_prefix(output, "pod/");
        assert_eq!(result, vec!["mysql-0", "mysql-1"]);
    }

    #[test]
    fn test_no_match_returns_full_line() {
        let output = "something/else\n";
        let result = parse_lines_with_prefix(output, "namespace/");
        assert_eq!(result, vec!["something/else"]);
    }

    #[test]
    fn test_empty_output() {
        let result = parse_lines_with_prefix("", "namespace/");
        assert!(result.is_empty());
    }
}

mod parse_resource_ports_tests {
    use super::*;

    #[test]
    fn test_single_port() {
        let result = parse_resource_ports("5432");
        assert_eq!(result, vec![5432]);
    }

    #[test]
    fn test_multiple_ports() {
        let result = parse_resource_ports("80 443 5432");
        assert_eq!(result, vec![80, 443, 5432]);
    }

    #[test]
    fn test_ignores_invalid_values() {
        let result = parse_resource_ports("abc 3306 70000 8123");
        assert_eq!(result, vec![3306, 8123]);
    }

    #[test]
    fn test_empty_output() {
        let result = parse_resource_ports("");
        assert!(result.is_empty());
    }
}
