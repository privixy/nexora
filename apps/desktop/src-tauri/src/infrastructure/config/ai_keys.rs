use tauri::{AppHandle, Manager, Runtime};

pub use super::{get_ai_api_key, get_ai_api_key_status, AiKeyStatus};

pub fn store<R: Runtime>(
    app: &AppHandle<R>,
    provider: &str,
    key: &str,
) -> Result<(), String> {
    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    store_with(
        provider,
        key,
        crate::keychain_utils::set_ai_key,
        |provider, key| crate::credential_cache::set_ai_key_cached(&cache, provider, key),
    )
}

pub fn delete<R: Runtime>(app: &AppHandle<R>, provider: &str) -> Result<(), String> {
    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    delete_with(
        provider,
        crate::keychain_utils::delete_ai_key,
        |provider| crate::credential_cache::invalidate_ai_key(&cache, provider),
    )
}

pub(crate) fn store_with(
    provider: &str,
    key: &str,
    write_keychain: impl FnOnce(&str, &str) -> Result<(), String>,
    write_cache: impl FnOnce(&str, &str),
) -> Result<(), String> {
    write_keychain(provider, key)?;
    write_cache(provider, key);
    Ok(())
}

pub(crate) fn delete_with(
    provider: &str,
    delete_keychain: impl FnOnce(&str) -> Result<(), String>,
    invalidate_cache: impl FnOnce(&str),
) -> Result<(), String> {
    delete_keychain(provider)?;
    invalidate_cache(provider);
    Ok(())
}
