use super::super::protocol::JsonRpcRequest;
use super::super::router::handle_request;
use serde_json::json;

#[tokio::test]
async fn notifications_return_no_response() {
    let request = JsonRpcRequest {
        jsonrpc: "2.0".into(),
        id: None,
        method: "notifications/initialized".into(),
        params: None,
    };
    assert!(handle_request(request).await.is_none());
}

#[tokio::test]
async fn unknown_methods_return_method_not_found() {
    let request = JsonRpcRequest {
        jsonrpc: "2.0".into(),
        id: Some(json!(1)),
        method: "unknown".into(),
        params: None,
    };
    let response = handle_request(request).await.unwrap();
    assert_eq!(response.error.unwrap().code, -32601);
}
