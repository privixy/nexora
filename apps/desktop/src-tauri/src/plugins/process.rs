use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot};

use crate::plugins::rpc::{JsonRpcRequest, JsonRpcResponse};

pub(crate) const PLUGIN_CALL_TIMEOUT: Duration = Duration::from_secs(120);
pub(crate) const PLUGIN_INIT_TIMEOUT: Duration = Duration::from_secs(15);
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub(crate) enum PluginCommand {
    Call(JsonRpcRequest, oneshot::Sender<Result<Value, String>>),
    Cancel(u64),
}

pub struct PluginProcess {
    pub(crate) sender: mpsc::Sender<PluginCommand>,
    pub(crate) next_id: AtomicU64,
    pub(crate) shutdown_tx: tokio::sync::Mutex<Option<oneshot::Sender<()>>>,
    pub pid: Option<u32>,
}

impl PluginProcess {
    pub(crate) async fn new(
        executable_path: PathBuf,
        interpreter: Option<String>,
    ) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel::<PluginCommand>(100);
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        let mut command = if let Some(ref interpreter) = interpreter {
            let mut command = Command::new(interpreter);
            command.arg(&executable_path);
            command
        } else {
            Command::new(&executable_path)
        };

        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);

        let child = command
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .map_err(|error| {
                format!(
                    "Failed to start plugin process {:?}: {}",
                    executable_path, error
                )
            })?;
        let pid = child.id();

        tokio::spawn(async move {
            let mut child = child;
            let mut rx = rx;
            let mut shutdown_rx = shutdown_rx;
            let mut stdin = child.stdin.take().expect("Failed to open stdin");
            let stdout = child.stdout.take().expect("Failed to open stdout");
            let mut reader = BufReader::new(stdout);
            let mut pending_requests: HashMap<u64, oneshot::Sender<Result<Value, String>>> =
                HashMap::new();
            let mut line_buf = String::new();

            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => {
                        log::info!("Plugin process shutdown requested, terminating child");
                        let _ = child.kill().await;
                        break;
                    }
                    message = rx.recv() => {
                        match message {
                            Some(PluginCommand::Call(request, response_tx)) => {
                                let id = request.id;
                                pending_requests.insert(id, response_tx);
                                let mut request = serde_json::to_string(&request).unwrap();
                                request.push('\n');
                                if let Err(error) = stdin.write_all(request.as_bytes()).await {
                                    log::error!("Failed to write to plugin stdin: {}", error);
                                    if let Some(tx) = pending_requests.remove(&id) {
                                        let _ = tx.send(Err(format!("Plugin communication error: {}", error)));
                                    }
                                }
                            }
                            Some(PluginCommand::Cancel(id)) => {
                                pending_requests.remove(&id);
                            }
                            None => {
                                log::warn!("Plugin process channel closed without shutdown signal, terminating child");
                                let _ = child.kill().await;
                                break;
                            }
                        }
                    }
                    result = reader.read_line(&mut line_buf) => {
                        match result {
                            Ok(0) => {
                                log::error!("Plugin process exited unexpectedly");
                                break;
                            }
                            Ok(_) => {
                                match serde_json::from_str::<JsonRpcResponse>(&line_buf) {
                                    Ok(JsonRpcResponse::Success { result, id, .. }) => {
                                        if let Some(tx) = pending_requests.remove(&id) {
                                            let _ = tx.send(Ok(result));
                                        }
                                    }
                                    Ok(JsonRpcResponse::Error { error, id, .. }) => {
                                        if let Some(tx) = pending_requests.remove(&id) {
                                            let _ = tx.send(Err(error.message));
                                        }
                                    }
                                    Err(error) => log::error!("Failed to parse plugin response: {}", error),
                                }
                                line_buf.clear();
                            }
                            Err(error) => {
                                log::error!("Failed to read from plugin stdout: {}", error);
                                break;
                            }
                        }
                    }
                }
            }
        });

        Ok(Self {
            sender: tx,
            next_id: AtomicU64::new(1),
            shutdown_tx: tokio::sync::Mutex::new(Some(shutdown_tx)),
            pid,
        })
    }

    pub(crate) async fn shutdown(&self) {
        let mut guard = self.shutdown_tx.lock().await;
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
        }
    }

    pub(crate) async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        self.call_with_timeout(method, params, PLUGIN_CALL_TIMEOUT)
            .await
    }

    pub(crate) async fn call_with_timeout(
        &self,
        method: &str,
        params: Value,
        timeout: Duration,
    ) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
            id,
        };
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(PluginCommand::Call(request, tx))
            .await
            .map_err(|_| "Plugin process channel closed".to_string())?;

        match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err("Plugin process did not respond".to_string()),
            Err(_) => {
                let _ = self.sender.send(PluginCommand::Cancel(id)).await;
                Err(format!(
                    "Plugin call '{}' timed out after {}s",
                    method,
                    timeout.as_secs()
                ))
            }
        }
    }
}
