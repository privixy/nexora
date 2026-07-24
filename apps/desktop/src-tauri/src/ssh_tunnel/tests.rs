use super::*;

mod build_tunnel_key_tests {
    use super::*;

    #[test]
    fn test_basic_key_format() {
        let key = build_tunnel_key("user", "host.example.com", 22, "db.internal", 3306);
        assert_eq!(key, "user@host.example.com:22:db.internal->3306");
    }

    #[test]
    fn test_non_standard_port() {
        let key = build_tunnel_key("admin", "jump.server", 2222, "localhost", 5432);
        assert_eq!(key, "admin@jump.server:2222:localhost->5432");
    }

    #[test]
    fn test_empty_user() {
        let key = build_tunnel_key("", "host", 22, "remote", 80);
        assert_eq!(key, "@host:22:remote->80");
    }
}

mod russh_key_auth_tests {
    use super::*;

    #[test]
    fn test_generated_ed25519_key_ignores_rsa_hash_algorithm() {
        let mut rng = keys::key::safe_rng();
        let key = keys::PrivateKey::random(&mut rng, keys::Algorithm::Ed25519).unwrap();
        let key = PrivateKeyWithHashAlg::new(Arc::new(key), Some(keys::HashAlg::Sha512));
        assert_eq!(key.hash_alg(), None);
    }
}

mod should_use_system_ssh_tests {
    use super::*;

    #[test]
    fn test_none_password_uses_system() {
        assert!(should_use_system_ssh(None));
    }

    #[test]
    fn test_empty_password_uses_system() {
        assert!(should_use_system_ssh(Some("")));
    }

    #[test]
    fn test_whitespace_password_uses_system() {
        assert!(should_use_system_ssh(Some("   ")));
    }

    #[test]
    fn test_valid_password_uses_russh() {
        assert!(!should_use_system_ssh(Some("value")));
    }

    #[test]
    fn test_password_with_spaces_uses_russh() {
        assert!(!should_use_system_ssh(Some("two words")));
    }
}

mod is_empty_or_whitespace_tests {
    use super::*;

    #[test]
    fn test_none_is_empty() {
        assert!(is_empty_or_whitespace(None));
    }

    #[test]
    fn test_empty_string_is_empty() {
        assert!(is_empty_or_whitespace(Some("")));
    }

    #[test]
    fn test_whitespace_is_empty() {
        assert!(is_empty_or_whitespace(Some("  \t\n  ")));
    }

    #[test]
    fn test_content_is_not_empty() {
        assert!(!is_empty_or_whitespace(Some("content")));
    }

    #[test]
    fn test_content_with_whitespace_is_not_empty() {
        assert!(!is_empty_or_whitespace(Some("  content  ")));
    }
}
