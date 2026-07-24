use super::*;

/// `tokio_postgres` renders only the top-level error kind ("error performing
/// TLS handshake"); the concrete cause lives in the `source()` chain.
pub(crate) fn format_error_chain<E: std::error::Error + ?Sized>(err: &E) -> String {
    let mut out = err.to_string();
    let mut source = err.source();
    while let Some(cause) = source {
        out.push_str(" -> ");
        out.push_str(&cause.to_string());
        source = cause.source();
    }
    out
}

/// rustls 0.23 needs a process-level `CryptoProvider`; install once.
fn ensure_rustls_crypto_provider() {
    use std::sync::Once;
    static INSTALL: Once = Once::new();
    INSTALL.call_once(|| {
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
}
/// Build the rustls connector for the PostgreSQL pool.
///
/// `rustls` (not `native-tls`) because macOS Secure Transport applies a
/// strict `id-kp-serverAuth` EKU check to user-supplied root anchors, which
/// rejects valid CA certs with "The extended key usage is not valid".
///
/// `ssl_ca` (PEM file or bundle) overrides the platform trust store. This
/// is the path RDS users take: the macOS keychain does not trust the
/// regional Amazon RDS root CAs, so they must supply
/// `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`
/// (or a region-specific bundle) via the connection's CA Certificate field.
///
/// We deliberately do NOT vendor the RDS bundle in the repo: AWS rotates
/// these CAs every 1-3 years, and shipping a stale bundle in a release
/// silently breaks RDS users until they upgrade. Distributors who want
/// out-of-the-box RDS support can pull a fresh bundle at packaging time
/// (e.g. via a Dockerfile `RUN curl ...` or a build script that drops it
/// into `src-tauri/assets/`) and point users at the resulting path.
///
/// SSL modes:
/// - `disable`: no TLS
/// - `allow`/`prefer`: TLS without certificate verification
/// - `require`: force TLS without certificate verification
///   NOTE: Prior to v0.10.3, `require` validated the certificate chain.
///   It now matches libpq behavior (TLS without validation). Users who
///   need certificate validation should use `verify-ca` or `verify-full`.
/// - `verify-ca`: force TLS, validate certificate chain, skip hostname check.
///   Requires an explicit CA file — platform roots are not used to avoid
///   macOS Secure Transport EKU incompatibilities.
/// - `verify-full`: force TLS, validate certificate chain and hostname
pub(crate) fn build_postgres_tls_connector(
    params: &ConnectionParams,
) -> Result<MakeRustlsConnect, String> {
    ensure_rustls_crypto_provider();
    let ssl_mode = params.ssl_mode.as_deref().unwrap_or("prefer");
    let user_ca = params.ssl_ca.as_deref().filter(|s| !s.trim().is_empty());

    let config = match ssl_mode {
        "disable" | "allow" | "prefer" => {
            // No certificate verification for these modes.
            // The PgSslMode setting handles whether TLS is attempted.
            let verifier = Arc::new(NoCertVerifier::new());
            ClientConfig::builder()
                .dangerous()
                .with_custom_certificate_verifier(verifier)
                .with_no_client_auth()
        }
        "require" => {
            // Force TLS but skip all certificate validation.
            let verifier = Arc::new(NoCertVerifier::new());
            ClientConfig::builder()
                .dangerous()
                .with_custom_certificate_verifier(verifier)
                .with_no_client_auth()
        }
        "verify-ca" => {
            // Validate certificate chain but skip hostname verification.
            // Requires an explicit CA file — we deliberately do NOT fall back
            // to platform roots because macOS Secure Transport applies strict
            // id-kp-serverAuth EKU checks that reject valid CA certificates
            // (e.g. the AWS RDS bundle). This matches libpq's behavior where
            // sslmode=verify-ca expects root certs to be supplied explicitly.
            let ca_path = user_ca.ok_or_else(|| {
                "verify-ca mode requires an explicit CA file via the connection's \
                CA Certificate field. On macOS, platform root certificates are \
                not compatible with strict EKU checks. For automatic platform \
                trust, use verify-full instead."
                    .to_string()
            })?;
            let roots = load_roots_from_pem(ca_path)?;
            let verifier = Arc::new(VerifyCaCertVerifier::new(roots)?);
            ClientConfig::builder()
                .dangerous()
                .with_custom_certificate_verifier(verifier)
                .with_no_client_auth()
        }
        "verify-full" => {
            // Validate certificate chain AND hostname.
            if let Some(user_ca) = user_ca {
                // Use custom CA with full hostname verification.
                let roots = load_roots_from_pem(user_ca)?;
                let verifier = WebPkiServerVerifier::builder(Arc::new(roots))
                    .build()
                    .map_err(|e| format!("Failed to build certificate verifier: {e}"))?;
                ClientConfig::builder()
                    .dangerous()
                    .with_custom_certificate_verifier(verifier)
                    .with_no_client_auth()
            } else {
                // Use platform verifier for full validation.
                ClientConfig::builder()
                    .with_platform_verifier()
                    .map_err(|e| format!("Failed to build platform TLS verifier: {}", e))?
                    .with_no_client_auth()
            }
        }
        _ => {
            // Unknown mode, fall back to no verification.
            let verifier = Arc::new(NoCertVerifier::new());
            ClientConfig::builder()
                .dangerous()
                .with_custom_certificate_verifier(verifier)
                .with_no_client_auth()
        }
    };
    Ok(MakeRustlsConnect::new(config))
}

/// Load root certificates from a PEM file.
pub(crate) fn load_roots_from_pem(path: &str) -> Result<RootCertStore, String> {
    let pem =
        std::fs::read(path).map_err(|e| format!("Failed to read ssl_ca file '{}': {}", path, e))?;
    let mut roots = RootCertStore::empty();
    let mut cursor = std::io::Cursor::new(&pem[..]);
    for cert in rustls_pemfile::certs(&mut cursor) {
        let cert = cert.map_err(|e| format!("Failed to parse ssl_ca '{}': {}", path, e))?;
        roots
            .add(cert)
            .map_err(|e| format!("Failed to add ssl_ca cert from '{}': {}", path, e))?;
    }
    if roots.is_empty() {
        return Err(format!(
            "ssl_ca '{}' contained no PEM CERTIFICATE blocks",
            path
        ));
    }
    Ok(roots)
}

/// A certificate verifier that skips certificate validation entirely.
/// Used for sslmode=require, prefer, allow.
#[derive(Debug)]
struct NoCertVerifier {
    supported: rustls::crypto::WebPkiSupportedAlgorithms,
}

impl NoCertVerifier {
    fn new() -> Self {
        let provider = CryptoProvider::get_default().expect("rustls CryptoProvider not installed");
        Self {
            supported: provider.signature_verification_algorithms,
        }
    }
}

impl ServerCertVerifier for NoCertVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, TlsError> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        self.supported.supported_schemes()
    }
}

/// A certificate verifier that validates the certificate chain against
/// a custom root store but skips hostname verification.
/// Matches libpq `sslmode=verify-ca` behavior.
///
/// Uses `verify_server_cert_signed_by_trust_anchor` directly rather than
/// wrapping `WebPkiServerVerifier` — this makes the "skip hostname check"
/// intent explicit, avoids double-verifying the chain, and prevents the
/// fragile `.or(Ok(...))` error-recovery pattern.
#[derive(Debug)]
struct VerifyCaCertVerifier {
    roots: Arc<RootCertStore>,
    supported: rustls::crypto::WebPkiSupportedAlgorithms,
}

impl VerifyCaCertVerifier {
    fn new(roots: RootCertStore) -> Result<Self, String> {
        if roots.is_empty() {
            return Err("No root certificates available. For verify-ca mode, \
                you must specify an explicit CA file via the connection's \
                CA Certificate field. On macOS, the system keychain does \
                not provide root anchors compatible with strict EKU checks."
                .to_string());
        }
        let provider = CryptoProvider::get_default().ok_or("No rustls CryptoProvider installed")?;
        Ok(Self {
            roots: Arc::new(roots),
            supported: provider.signature_verification_algorithms,
        })
    }
}

impl ServerCertVerifier for VerifyCaCertVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, TlsError> {
        // Validate the certificate chain against our root store.
        // We intentionally skip hostname verification (verify-ca semantics).
        let cert = ParsedCertificate::try_from(end_entity)?;
        verify_server_cert_signed_by_trust_anchor(
            &cert,
            &self.roots,
            intermediates,
            now,
            self.supported.all,
        )?;
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        verify_tls12_signature(message, cert, dss, &self.supported)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        verify_tls13_signature(message, cert, dss, &self.supported)
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        self.supported.supported_schemes()
    }
}
