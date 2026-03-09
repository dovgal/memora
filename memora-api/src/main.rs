mod domain;
mod handlers;
mod live_ws;
mod middleware;

use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post, patch, delete},
    Router,
};
use live_ws::RoomRegistry;
use sqlx::postgres::PgPoolOptions;
use std::env;
use tower_http::cors::{CorsLayer, Any};

#[derive(Clone)]
struct AppState {
    db: sqlx::PgPool,
    rate_limiter: middleware::rate_limiter::AppRateLimiter,
    room_registry: RoomRegistry,
}

impl axum::extract::FromRef<AppState> for sqlx::PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.db.clone()
    }
}

impl axum::extract::FromRef<AppState> for middleware::rate_limiter::AppRateLimiter {
    fn from_ref(state: &AppState) -> Self {
        state.rate_limiter.clone()
    }
}

impl axum::extract::FromRef<AppState> for RoomRegistry {
    fn from_ref(state: &AppState) -> Self {
        state.room_registry.clone()
    }
}

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

    // Initialize Rate Limiter for AI Gateway
    let rate_limiter = middleware::rate_limiter::initialize_rate_limiter();

    // Initialize in-memory room registry for Live Mode
    let room_registry = RoomRegistry::new();

    let app_state = AppState {
        db: pool,
        rate_limiter,
        room_registry,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "Memora API is running" }))
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/protected/me", get(handlers::protected::me_handler))
        .route("/api/users/onboarding", post(handlers::users::finish_onboarding))
        .route("/api/users/role", patch(handlers::users::update_role))
        .route("/api/sets", get(handlers::sets::get_user_sets).post(handlers::sets::create_set))
        .route(
            "/api/sets/{id}",
            get(handlers::sets::get_public_set)
                .delete(handlers::sets::delete_set)
                .put(handlers::sets::update_set)
        )
        .route("/api/study/progress", post(handlers::study::record_study_progress))
        .route("/api/study/fsrs/review", post(handlers::study::fsrs_review))
        .route("/api/sets/{id}/progress", get(handlers::study::get_set_progress))
        .route("/api/sets/{id}/fsrs/due", get(handlers::study::get_fsrs_due))
        .route("/api/ai/generate", post(handlers::ai::generate_flashcards_stream))
        .route("/api/images/generate", post(handlers::ai::generate_image))
        .route("/api/ai/qchat/{set_id}", post(handlers::ai::qchat_stream))
        // Folders routes
        .route("/api/folders", get(handlers::folders::get_user_folders).post(handlers::folders::create_folder))
        .route("/api/folders/{id}", get(handlers::folders::get_folder))
        .route("/api/folders/{id}/sets", post(handlers::folders::add_set_to_folder))
        .route("/api/folders/{id}/sets/{set_id}", delete(handlers::folders::remove_set_from_folder))
        // Live Mode routes (Story 5.1)
        .route("/api/live/rooms", post(handlers::live::create_room))
        .route("/api/live/rooms/{join_code}", get(handlers::live::resolve_room))
        .route("/api/live/ws", get(handlers::live::ws_handler))
        .layer(cors)
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .with_state(app_state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8000".to_string());
    let addr = format!("0.0.0.0:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap();

    println!("Server running on http://{}", addr);
    axum::serve(listener, app).await.unwrap();
}

