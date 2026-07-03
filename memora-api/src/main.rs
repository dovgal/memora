mod domain;
mod handlers;
mod live_ws;
mod llm;
mod mathsvc;
mod middleware;
mod subjects;
mod workers;

use axum::{
    extract::{DefaultBodyLimit, State},
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

    // Run database migrations
    sqlx::migrate!()
        .run(&pool)
        .await
        .expect("Failed to run database migrations");

    // Фоновая прегенерация вариантов упражнений (см. workers::variant_pregen).
    workers::variant_pregen::spawn(pool.clone());

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
        .route("/api/auth/oauth/google", post(handlers::auth::oauth_google))
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
        .route("/api/sets/{id}/fsrs/reset", delete(handlers::study::reset_fsrs_progress))
        .route("/api/ai/generate", post(handlers::ai::generate_flashcards_stream))
        .route("/api/ai/learn/generate", post(handlers::ai::generate_exercises))
        .route("/api/ai/learn/grade", post(handlers::ai::grade_answer))
        .route("/api/ai/a2/generate-questions", post(handlers::ai::generate_a2_questions))
        .route("/api/ai/creator/analyze", post(handlers::ai::analyze_content))
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
        // Audio routes
        .route("/api/audio/{id}/{field}", get(handlers::audio::get_flashcard_audio))
        // Generic Inworld TTS for arbitrary text (course tests/exercises)
        .route("/api/tts", get(handlers::audio::synthesize_tts))
        // A2 classes / leaderboard / diagnostics / teacher / analytics
        .route("/api/a2/classes", post(handlers::classes::create_class).get(handlers::classes::my_classes))
        .route("/api/a2/classes/join", post(handlers::classes::join_class))
        .route("/api/a2/classes/{join_code}/leaderboard", get(handlers::classes::class_leaderboard))
        .route("/api/a2/xp", post(handlers::classes::submit_xp))
        .route("/api/a2/diagnostic", post(handlers::classes::submit_diagnostic))
        .route("/api/a2/error-stat", post(handlers::classes::report_error_stat))
        .route("/api/a2/analytics/errors", get(handlers::classes::error_analytics))
        .route("/api/a2/teacher/classes/{class_id}/overview", get(handlers::classes::teacher_overview))
        .route("/api/a2/assignments", post(handlers::classes::create_assignment).get(handlers::classes::my_assignments))
        // Generic course-trainer progress (Edito A1 and others)
        .route("/api/courses/{course_id}/progress", get(handlers::course_progress::get_course_progress).post(handlers::course_progress::record_course_progress))
        // Пользовательские курсы: создание и редактирование (любой пользователь)
        .route("/api/courses", get(handlers::courses::list_courses).post(handlers::courses::create_course))
        .route(
            "/api/courses/{course_id}",
            get(handlers::courses::get_course)
                .put(handlers::courses::update_course)
                .delete(handlers::courses::delete_course)
        )
        .route("/api/courses/{course_id}/units", post(handlers::courses::create_unit))
        .route(
            "/api/courses/{course_id}/units/{unit_id}",
            get(handlers::courses::get_unit)
                .put(handlers::courses::update_unit)
                .delete(handlers::courses::delete_unit)
        )
        // Коуч-режим: интервальное повторение упражнений курса (FSRS)
        .route("/api/courses/{course_id}/coach/reviews", get(handlers::coach::get_coach_reviews))
        .route("/api/courses/{course_id}/coach/review", post(handlers::coach::record_coach_review))
        .route("/api/courses/{course_id}/coach/stats", get(handlers::coach::get_coach_stats))
        .route("/api/courses/{course_id}/coach/rating-stats", get(handlers::coach::get_rating_stats))
        .route("/api/courses/{course_id}/coach/session-plan", get(handlers::coach::get_session_plan))
        .route("/api/courses/{course_id}/dictionary", post(handlers::courses::add_to_dictionary))
        // Источники (учебники): search раньше {id}, иначе 'search' матчится как UUID.
        .route("/api/sources/search", get(handlers::sources::search_sources))
        .route("/api/sources", get(handlers::sources::list_sources).post(handlers::sources::upload_source))
        .route("/api/sources/{id}", get(handlers::sources::get_source).delete(handlers::sources::delete_source))
        .route("/api/sources/{id}/chunks/{chunk_id}", get(handlers::sources::get_chunk))
        .route("/api/check/symbolic", post(handlers::checks::check_symbolic))
        .route("/api/family/board", get(handlers::family::get_board))
        .route("/api/family/member/{user_id}/courses", get(handlers::family::get_member_courses))
        .route("/api/courses/{course_id}/coach/mark-known", post(handlers::coach::mark_known))
        // Классы v2: кабинеты преподавателя/ученика, задания, сообщения, подписки
        .route("/api/classes/mine", get(handlers::classroom::my_classes_all))
        .route("/api/classes/{id}/detail", get(handlers::classroom::class_detail))
        .route(
            "/api/classes/{id}/assignments",
            get(handlers::classroom::list_class_assignments)
                .post(handlers::classroom::create_class_assignment)
        )
        .route(
            "/api/classes/{id}/messages",
            get(handlers::classroom::list_class_messages)
                .post(handlers::classroom::post_class_message)
        )
        .route("/api/assignments/{id}/done", post(handlers::classroom::mark_assignment_done))
        .route("/api/subscriptions", get(handlers::classroom::list_subscriptions).post(handlers::classroom::add_subscription))
        .route("/api/subscriptions/{course_id}", delete(handlers::classroom::remove_subscription))
        // ИИ-инструменты курсов: генерация юнита, тьютор, практика, разговор, истории
        .route("/api/ai/course/generate-unit", post(handlers::ai::generate_course_unit))
        .route("/api/ai/course/explain", post(handlers::ai::explain_exercise))
        .route("/api/ai/course/generate-practice", post(handlers::ai::generate_practice))
        .route("/api/ai/course/converse", post(handlers::ai::converse))
        .route("/api/ai/course/story", post(handlers::ai::generate_story))
        .route("/api/ai/course/regenerate-variant", post(handlers::ai::regenerate_variant))
        // Diagnostics (Temporary). Только для авторизованных пользователей.
        .route("/api/diag/db", get(|_user: middleware::auth::AuthenticatedUser, State(pool): State<sqlx::PgPool>| async move {
            let audio_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM flashcard_audio").fetch_one(&pool).await.unwrap_or((-1,));
            let card_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM flashcards").fetch_one(&pool).await.unwrap_or((-1,));
            let legacy_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM flashcards WHERE fields_data::text LIKE '%audio/mpeg;base64%'").fetch_one(&pool).await.unwrap_or((-1,));
            let marker_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM flashcards WHERE fields_data::text LIKE '%__AUDIO_ON_SERVER__%'").fetch_one(&pool).await.unwrap_or((-1,));
            let inworld_auth_set = std::env::var("INWORLD_AUTH").is_ok();
            
            format!(
                "Audio Rows: {}\nTotal Cards: {}\nLegacy (Base64) Cards: {}\nMarker Cards: {}\nINWORLD_AUTH Set: {}",
                audio_count.0, card_count.0, legacy_count.0, marker_count.0, inworld_auth_set
            )
        }))
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
