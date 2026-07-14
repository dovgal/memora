// Семейное табло: XP, серии и прогресс всех членов семьи + разбивка по курсам.
// Для семейного масштаба это одновременно и «лидерборд», и отчёт наставника
// (план июля-2026, слайс 18): любой авторизованный пользователь видит всех —
// инсталляция приватная, соревновательность внутри семьи и есть цель.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

#[derive(Deserialize)]
pub struct BoardQuery {
    /// Смещение часового пояса клиента в минутах (как в /coach/stats).
    pub tz_offset_min: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FamilyMember {
    pub user_id: String,
    pub name: String,
    /// Суммарный XP: универсальный (user_xp) + legacy A2 (a2_xp).
    pub xp: i64,
    pub streak_days: i64,
    pub today_reviews: i64,
    pub total_reviews: i64,
    pub learned_count: i64,
}

/// Streak по ВСЕМ курсам: подряд идущие дни занятий, заканчивающиеся сегодня или вчера.
/// (Та же логика, что в coach::get_coach_stats, но без фильтра по курсу.)
async fn streak_all_courses(pool: &PgPool, user_id: Uuid, offset_min: i32) -> i64 {
    let day_rows = sqlx::query(
        "SELECT DISTINCT (review_time + ($2 || ' minutes')::interval)::date AS day
         FROM course_review_logs
         WHERE user_id = $1
         ORDER BY day DESC
         LIMIT 400"
    )
    .bind(user_id)
    .bind(offset_min.to_string())
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let days: Vec<chrono::NaiveDate> = day_rows.iter().map(|r| r.get::<chrono::NaiveDate, _>("day")).collect();
    let today = (chrono::Utc::now() + chrono::Duration::minutes(offset_min as i64)).date_naive();

    let mut streak: i64 = 0;
    let mut expected = today;
    for d in &days {
        if *d == expected {
            streak += 1;
            expected -= chrono::Duration::days(1);
        } else if streak == 0 && *d == today - chrono::Duration::days(1) {
            streak += 1;
            expected = *d - chrono::Duration::days(1);
        } else {
            break;
        }
    }
    streak
}

/// GET /api/family/board?tz_offset_min=180 — табло всех членов семьи.
pub async fn get_board(
    State(pool): State<PgPool>,
    AuthenticatedUser(_user): AuthenticatedUser,
    Query(q): Query<BoardQuery>,
) -> ApiResult<impl IntoResponse> {
    let offset_min = q.tz_offset_min.unwrap_or(0).clamp(-840, 840);

    // Приватность: полный email в ответ НЕ отдаём. Имя — из профиля; если его нет,
    // показываем только локальную часть email (хэндл до «@»), а не адрес целиком —
    // так посторонний, зарегистрировавшийся на инстансе, не выкачает контакты семьи.
    let rows = sqlx::query(
        "SELECT u.id,
                COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', COALESCE(p.last_name, ''))), ''),
                         split_part(u.email, '@', 1)) AS name,
                COALESCE(x.xp, 0) + COALESCE(a.xp, 0) AS xp,
                (SELECT COUNT(*) FROM course_review_logs l WHERE l.user_id = u.id) AS total_reviews,
                (SELECT COUNT(*) FROM course_review_logs l WHERE l.user_id = u.id
                   AND (l.review_time + ($1 || ' minutes')::interval)::date
                     = (NOW() + ($1 || ' minutes')::interval)::date) AS today_reviews,
                (SELECT COUNT(*) FROM course_exercise_reviews r WHERE r.user_id = u.id AND r.state = 2) AS learned
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN user_xp x ON x.user_id = u.id
         LEFT JOIN a2_xp a ON a.user_id = u.id
         ORDER BY xp DESC, total_reviews DESC"
    )
    .bind(offset_min.to_string())
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    // Семья — считанные пользователи, per-user запрос серии дешёв.
    let mut members = Vec::with_capacity(rows.len());
    for r in rows {
        let user_id: Uuid = r.get("id");
        members.push(FamilyMember {
            user_id: user_id.to_string(),
            name: r.get("name"),
            xp: r.get::<i64, _>("xp"),
            streak_days: streak_all_courses(&pool, user_id, offset_min).await,
            today_reviews: r.get("today_reviews"),
            total_reviews: r.get("total_reviews"),
            learned_count: r.get("learned"),
        });
    }

    Ok((StatusCode::OK, Json(members)))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberCourse {
    pub course_id: String,
    /// Название пользовательского курса; для встроенных — id (фронтенд знает красивые имена).
    pub title: Option<String>,
    pub total_reviews: i64,
    pub learned: i64,
    /// Слабых мест за 30 дней (те же пороги, что карта навыков: ≥4 попыток, ≥35% ошибок).
    pub weak_count: i64,
}

/// GET /api/family/member/{user_id}/courses — разбивка прогресса участника по курсам
/// (отчёт наставника: где занимается, что усвоено, где слабые места).
pub async fn get_member_courses(
    State(pool): State<PgPool>,
    AuthenticatedUser(_user): AuthenticatedUser,
    Path(user_id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    let rows = sqlx::query(
        "SELECT l.course_id,
                COUNT(*) AS total_reviews,
                (SELECT COUNT(*) FROM course_exercise_reviews r
                  WHERE r.user_id = $1 AND r.course_id = l.course_id AND r.state = 2) AS learned
         FROM course_review_logs l
         WHERE l.user_id = $1
         GROUP BY l.course_id
         ORDER BY total_reviews DESC"
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    // Слабые места по курсам одним запросом.
    let weak_rows = sqlx::query(
        "SELECT course_id, COUNT(*) AS weak FROM (
            SELECT course_id FROM course_review_logs
            WHERE user_id = $1 AND review_time >= NOW() - interval '30 days'
            GROUP BY course_id, unit_id, exercise_id
            HAVING COUNT(*) >= 4
               AND (COUNT(*) FILTER (WHERE rating = 1) + 0.5 * COUNT(*) FILTER (WHERE rating = 2))::float8
                     / COUNT(*) >= 0.35
         ) t GROUP BY course_id"
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    let weak_by_course: std::collections::HashMap<String, i64> = weak_rows.iter()
        .map(|r| (r.get::<String, _>("course_id"), r.get::<i64, _>("weak")))
        .collect();

    // Названия пользовательских курсов (UUID-иды).
    let uuid_ids: Vec<Uuid> = rows.iter()
        .filter_map(|r| Uuid::parse_str(&r.get::<String, _>("course_id")).ok())
        .collect();
    let title_rows = sqlx::query("SELECT id, title FROM custom_courses WHERE id = ANY($1)")
        .bind(&uuid_ids)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
    let titles: std::collections::HashMap<String, String> = title_rows.iter()
        .map(|r| (r.get::<Uuid, _>("id").to_string(), r.get::<String, _>("title")))
        .collect();

    let courses: Vec<MemberCourse> = rows.into_iter().map(|r| {
        let course_id: String = r.get("course_id");
        MemberCourse {
            title: titles.get(&course_id).cloned(),
            total_reviews: r.get("total_reviews"),
            learned: r.get("learned"),
            weak_count: weak_by_course.get(&course_id).copied().unwrap_or(0),
            course_id,
        }
    }).collect();

    Ok((StatusCode::OK, Json(courses)))
}
