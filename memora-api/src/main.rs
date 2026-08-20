mod domain;
mod handlers;
mod live_ws;
mod llm;
mod mathsvc;
mod middleware;
mod pushsvc;
mod subjects;
mod workers;

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

    // Set up database connection pool.
    // Размер настраивается через DB_MAX_CONNECTIONS. По умолчанию 20: Railway
    // Postgres даёт max_connections=100, а пул в 5 упирался в лимит под
    // параллельными запросами страниц («pool timed out waiting for connection»).
    // acquire_timeout 5s — быстрый отказ вместо 30-секундного зависания хендлера.
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let max_connections: u32 = env::var("DB_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20);
    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .acquire_timeout(std::time::Duration::from_secs(5))
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

    // Ежедневные push-напоминания о повторениях (см. workers::push_reminder).
    workers::push_reminder::spawn(pool.clone());

    // Initialize Rate Limiter for AI Gateway
    let rate_limiter = middleware::rate_limiter::initialize_rate_limiter();

    // Initialize in-memory room registry for Live Mode
    let room_registry = RoomRegistry::new();

    let app_state = AppState {
        db: pool,
        rate_limiter,
        room_registry,
    };

    // CORS: только доверенные origin-ы (браузер и так ходит через Next-прокси same-origin,
    // прямые кросс-доменные запросы разрешаем только фронтенду). Список — через env.
    let allowed_origins = env::var("FRONTEND_ORIGINS").unwrap_or_else(|_| {
        "https://memora-web-production.up.railway.app,http://localhost:3000".to_string()
    });
    let origins: Vec<axum::http::HeaderValue> = allowed_origins
        .split(',')
        .filter_map(|o| o.trim().parse().ok())
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(origins)
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
        .route(
            "/api/courses/{course_id}/units/{unit_id}/translated",
            get(handlers::courses::get_unit_translated)
        )
        // Коуч-режим: интервальное повторение упражнений курса (FSRS)
        .route("/api/courses/{course_id}/coach/reviews", get(handlers::coach::get_coach_reviews))
        .route("/api/courses/{course_id}/coach/review", post(handlers::coach::record_coach_review))
        .route("/api/courses/{course_id}/coach/stats", get(handlers::coach::get_coach_stats))
        .route("/api/courses/{course_id}/coach/rating-stats", get(handlers::coach::get_rating_stats))
        .route("/api/courses/{course_id}/coach/session-plan", get(handlers::coach::get_session_plan))
        .route("/api/courses/{course_id}/dictionary", post(handlers::courses::add_to_dictionary))
        .route("/api/courses/{course_id}/vocabulary-set", post(handlers::courses::export_vocabulary_set))
        // Источники (учебники): search раньше {id}, иначе 'search' матчится как UUID.
        .route("/api/sources/search", get(handlers::sources::search_sources))
        .route("/api/sources", get(handlers::sources::list_sources).post(handlers::sources::upload_source))
        .route("/api/sources/{id}", get(handlers::sources::get_source).delete(handlers::sources::delete_source))
        .route("/api/sources/{id}/chunks/{chunk_id}", get(handlers::sources::get_chunk))
        // Читалка книг: полка, главы, словарь читателя, карточки из книги.
        .route("/api/books", get(handlers::books::list_books).post(handlers::books::create_book))
        .route(
            "/api/books/{id}",
            get(handlers::books::get_book)
                .patch(handlers::books::update_book)
                .delete(handlers::books::delete_book)
        )
        .route("/api/books/{id}/chapters", post(handlers::books::add_chapters))
        .route("/api/books/{id}/chapters/{position}", get(handlers::books::get_chapter))
        .route("/api/books/{id}/finalize", post(handlers::books::finalize_book))
        .route("/api/books/{id}/search", get(handlers::books::search_book))
        .route("/api/books/{id}/vocab", get(handlers::books::get_vocab).put(handlers::books::put_vocab))
        .route("/api/books/{id}/cards", post(handlers::books::add_card))
        // Перевод (DeepL с кэшем) и словарная статья (LLM) — для читалки.
        .route("/api/translate", post(handlers::translate::translate_handler))
        .route("/api/dictionary", post(handlers::translate::dictionary_handler))
        .route("/api/check/symbolic", post(handlers::checks::check_symbolic))
        .route("/api/family/board", get(handlers::family::get_board))
        .route("/api/family/member/{user_id}/courses", get(handlers::family::get_member_courses))
        .route("/api/push/public-key", get(handlers::push::get_public_key))
        .route("/api/push/subscribe", post(handlers::push::subscribe))
        .route("/api/push/unsubscribe", post(handlers::push::unsubscribe))
        .route("/api/push/test", post(handlers::push::send_test))
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
        .layer(cors)

        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .with_state(app_state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8000".to_string());
    let addr = format!("0.0.0.0:{port}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap();

    println!("Server running on http://{addr}");
    axum::serve(listener, app).await.unwrap();
}
