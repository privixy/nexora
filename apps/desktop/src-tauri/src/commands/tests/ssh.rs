use crate::commands::{resolve_ssh_test_credential, resolve_ssh_test_password};
use crate::models::SshConnection;

fn saved() -> SshConnection {
    SshConnection {
        id: "ssh-1".into(),
        name: "SSH".into(),
        host: "host".into(),
        port: 22,
        user: "user".into(),
        auth_type: Some("password".into()),
        password: Some("stored".into()),
        key_file: None,
        key_passphrase: None,
        allow_passphrase_prompt: None,
        save_in_keychain: Some(true),
    }
}

#[test]
fn ssh_password_prefers_request() {
    assert_eq!(
        resolve_ssh_test_password(
            Some("request"),
            Some("ssh-1"),
            |_| Some(saved()),
            |_| Ok("keychain".into()),
        ),
        Some("request".into())
    );
}

#[test]
fn ssh_credential_falls_back_when_keychain_is_blank() {
    let resolved = resolve_ssh_test_credential(
        None,
        Some("ssh-1"),
        |_| Some(saved()),
        |_| Ok("   ".into()),
        |connection| connection.password.clone(),
    );
    assert_eq!(resolved, Some("stored".into()));
}
