mod domain;
mod handlers;
mod middleware;

use axum::{
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() {
    // Load environment variables from .env
    dotenvy::dotenv().ok();

    // Set up database connection pool
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    // Configure the Axum application with our protected route
    // The middleware is enforced per-endpoint or router using the extractors
    let app = Router::new()
        .route("/", get(|| async { "Memora API is running" }))
        .route("/api/protected/me", get(handlers::protected::me_handler))
        .route("/api/users/onboarding", post(handlers::users::finish_onboarding))
        .route("/api/users/role", axum::routing::patch(handlers::users::update_role))
        .route("/api/sets/:id", get(handlers::sets::get_public_set))
        .route("/api/sets", post(handlers::sets::create_set))
        .route("/api/study/progress", post(handlers::study::record_study_progress))
        .route("/api/sets/:id/progress", get(handlers::study::get_set_progress))
        .with_state(pool);

    // Run our app
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .unwrap();
    
    println!("Server running on http://localhost:8000");
    axum::serve(listener, app).await.unwrap();
}
