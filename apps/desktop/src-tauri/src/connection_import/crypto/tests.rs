use super::*;
use openssl::symm::encrypt;

#[test]
fn dbeaver_roundtrip() {
    let plaintext = br##"{"conn":{"#connection":{"user":"bob","password":"secret"}}}"##;
    let iv = [7u8; 16];
    let ct = encrypt(Cipher::aes_128_cbc(), &DBEAVER_KEY, Some(&iv), plaintext).unwrap();
    let mut blob = iv.to_vec();
    blob.extend_from_slice(&ct);
    assert_eq!(decrypt_dbeaver(&blob).unwrap(), plaintext);
}

#[test]
fn dbeaver_rejects_short_input() {
    assert!(decrypt_dbeaver(&[0u8; 8]).is_none());
}

#[test]
fn beekeeper_string_roundtrip() {
    // Build a simple-encryptor payload: 64 hex (fake hmac) + 32 hex iv + b64 ct.
    use base64::Engine;
    let key_string = "my-user-key";
    let key = Sha256::digest(key_string.as_bytes());
    let iv = [3u8; 16];
    let plaintext = serde_json::to_vec("hunter2").unwrap(); // JSON-encoded string
    let ct = encrypt(Cipher::aes_256_cbc(), &key, Some(&iv), &plaintext).unwrap();

    let mut payload = "0".repeat(64); // hmac placeholder
    payload.push_str(&iv.iter().map(|b| format!("{:02x}", b)).collect::<String>());
    payload.push_str(&base64::engine::general_purpose::STANDARD.encode(&ct));

    assert_eq!(
        decrypt_beekeeper_string(&payload, key_string).unwrap(),
        "hunter2"
    );
}

#[test]
fn beekeeper_rejects_short_payload() {
    assert!(decrypt_beekeeper(&"a".repeat(96), "k").is_none());
}

#[test]
fn beekeeper_rejects_multibyte_payload_without_panicking() {
    // A multibyte char straddling byte offset 64/96 must not panic the
    // import; a byte-index slice here would. 50 'é' = 100 bytes.
    let payload = "é".repeat(50);
    assert!(decrypt_beekeeper(&payload, "k").is_none());
}
