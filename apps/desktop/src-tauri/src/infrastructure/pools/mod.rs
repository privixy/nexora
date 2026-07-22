mod key;
mod mysql;
mod postgres;
mod registry;
mod sqlite;
mod startup_script;
mod tls;

use crate::models::ConnectionParams;
use deadpool_postgres::{
    Hook as PgHook, HookError as PgHookError, Manager as PgPoolManager, Pool as PgPool,
};
use once_cell::sync::Lazy;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::client::{verify_server_cert_signed_by_trust_anchor, WebPkiServerVerifier};
use rustls::crypto::verify_tls12_signature;
use rustls::crypto::verify_tls13_signature;
use rustls::crypto::CryptoProvider;
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::server::ParsedCertificate;
use rustls::DigitallySignedStruct;
use rustls::{ClientConfig, Error as TlsError, RootCertStore};
use rustls_platform_verifier::BuilderVerifierExt;
use sha2::{Digest, Sha256};
use sqlx::{
    sqlite::SqliteConnectOptions, ConnectOptions, Connection, Executor, MySql, Pool, Sqlite,
};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio_postgres::{config::SslMode as PgSslMode, Config as PgConfig};
use tokio_postgres_rustls::MakeRustlsConnect;

pub(crate) use key::build_connection_key;
pub(crate) use mysql::{build_mysql_options, is_pipes_as_concat_unsupported};
pub use mysql::{get_mysql_pool, get_mysql_pool_for_database, get_mysql_pool_with_id};
pub(crate) use postgres::build_postgres_configurations;
pub use postgres::{get_postgres_pool, get_postgres_pool_with_id};
pub use registry::{
    close_all_pools, close_pool, close_pool_with_id, has_pool, has_pool_for_database,
};
use registry::{MYSQL_POOLS, POSTGRES_POOLS, SQLITE_POOLS};
pub use sqlite::{get_sqlite_pool, get_sqlite_pool_with_id};
use startup_script::{
    run_mysql_startup_script, run_postgres_startup_script, run_sqlite_startup_script,
    startup_script, startup_script_error,
};
pub(crate) use tls::{build_postgres_tls_connector, format_error_chain, load_roots_from_pem};

#[cfg(test)]
mod tests;
