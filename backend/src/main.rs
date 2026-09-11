use axum::{routing::get, Json, Router};
use serde::Serialize;
use tower_http::cors::CorsLayer;

#[derive(Serialize)]
struct Node {
    id: &'static str,
    label: &'static str,
    connections: Vec<&'static str>,
}

#[derive(Serialize)]
struct Station {
    nodes: Vec<Node>,
}

async fn health() -> &'static str {
    "ok"
}

async fn station() -> Json<Station> {
    Json(Station {
        nodes: vec![
            Node { id: "entrance", label: "Main entrance", connections: vec!["elevator", "escalator"] },
            Node { id: "elevator", label: "Elevator", connections: vec!["entrance", "platform-2"] },
            Node { id: "escalator", label: "Escalator", connections: vec!["entrance", "platform-2"] },
            Node { id: "platform-2", label: "Platform 2", connections: vec!["elevator", "escalator"] },
        ],
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/station", get(station))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    println!("backend on :3001");
    axum::serve(listener, app).await.unwrap();
}
