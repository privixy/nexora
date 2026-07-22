pub struct ConnectionService;

impl ConnectionService {
    pub async fn disconnect<
        Resolved,
        Unregister,
        UnregisterFuture,
        Resolve,
        ResolveFuture,
        Close,
        CloseFuture,
        Emit,
        EmitFuture,
    >(
        connection_id: &str,
        unregister: Unregister,
        resolve: Resolve,
        close: Close,
        emit: Emit,
    ) -> Result<(), String>
    where
        Unregister: FnOnce(String) -> UnregisterFuture,
        UnregisterFuture: std::future::Future<Output = ()>,
        Resolve: FnOnce(String) -> ResolveFuture,
        ResolveFuture: std::future::Future<Output = Result<Resolved, String>>,
        Close: FnOnce(Resolved, String) -> CloseFuture,
        CloseFuture: std::future::Future<Output = ()>,
        Emit: FnOnce() -> EmitFuture,
        EmitFuture: std::future::Future<Output = ()>,
    {
        unregister(connection_id.to_string()).await;
        let resolved = resolve(connection_id.to_string()).await?;
        close(resolved, connection_id.to_string()).await;
        emit().await;
        Ok(())
    }
}
