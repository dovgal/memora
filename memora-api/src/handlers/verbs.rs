// Неправильные глаголы английского: партия «с 1 по 20» и лесенка повторений
// по каждому глаголу отдельно (см. memora-web/src/lib/courses/verbs/types.ts —
// оттуда LADDER_DAYS и правило «ошибка спускает на одну ступень»).
//
// Своей таблицы не заводим: course_progress уже умеет пары
// (user_id, course_id, unit_id, exercise_id), и курс укладывается в тот же
// приём. У таблицы нет отдельного поля под значение — единственное текстовое
// поле, которое обработчик волен наполнять смыслом, это exercise_id (так же,
// как в course_progress.rs он несёт весь смысл записи). Поэтому и партия, и
// состояние глагола лежат внутри exercise_id, разобранные вручную:
//   unit_id = "assignment", exercise_id = "{from}-{to}"          — одна запись
//   unit_id = "verb",       exercise_id = "v{n}:{step}:{due}:{streak}:{misses}"
// Ключ (n у глагола) при каждом ответе меняется вместе со ступенью, поэтому
// ON CONFLICT не годится — строку удаляем и вставляем заново внутри транзакции.

use axum::{
    extract::State,
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

const COURSE_ID: &str = "verbs-irregular";
const UNIT_ASSIGNMENT: &str = "assignment";
const UNIT_VERB: &str = "verb";

/// Последний номер в школьной таблице — верхняя граница партии.
const MAX_VERB_N: i32 = 125;

/// Лесенка повторений в днях — тот же ряд, что LADDER_DAYS в types.ts.
/// Задан здесь отдельной константой, а не общим файлом с фронтендом:
/// сервер и клиент — разные языки, а расхождение тут же ловят тесты.
const LADDER_DAYS: [i64; 7] = [0, 1, 3, 7, 16, 35, 90];
const LAST_STEP: i32 = (LADDER_DAYS.len() - 1) as i32;

fn uid(sub: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

// ---------- DTO ----------

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct AssignmentDto {
    pub from: i32,
    pub to: i32,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct VerbStateDto {
    pub n: i32,
    pub step: i32,
    pub due: String,
    pub streak: i32,
    pub misses: i32,
}

#[derive(Serialize)]
pub struct GetVerbsStateResponse {
    pub assignment: Option<AssignmentDto>,
    pub states: Vec<VerbStateDto>,
}

#[derive(Deserialize)]
pub struct PutAssignmentRequest {
    pub from: i32,
    pub to: i32,
}

#[derive(Deserialize)]
pub struct ReviewRequest {
    pub n: i32,
    pub correct: bool,
}

// ---------- расчёт ступени и срока (чистая функция — испытывается без базы) ----------

/// Верный ответ поднимает на ступень (не выше последней) и продолжает серию;
/// ошибка спускает на одну ступень (не ниже нуля), сбрасывает серию и
/// добавляет промах. Так один промах в конце недели стоит одной ступени, а не
/// всей проделанной лесенки.
fn next_verb_state(n: i32, step: i32, streak: i32, misses: i32, correct: bool, today: chrono::NaiveDate) -> VerbStateDto {
    let (step, streak, misses) = if correct {
        (i32::min(step + 1, LAST_STEP), streak + 1, misses)
    } else {
        (i32::max(step - 1, 0), 0, misses + 1)
    };
    let due = today + chrono::Duration::days(LADDER_DAYS[step as usize]);
    VerbStateDto { n, step, due: due.format("%Y-%m-%d").to_string(), streak, misses }
}

// ---------- обработчики ----------

/// GET /api/verbs/state — текущая партия и состояние всех глаголов, по
/// которым уже был хоть один ответ. Молчание о глаголе значит «ещё не
/// встречался» — лесенка для него начинается с нуля на клиенте.
pub async fn get_verbs_state(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;

    let assignment = sqlx::query(
        "SELECT range_from, range_to FROM verb_assignment WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?
    .map(|r| AssignmentDto {
        from: r.get::<i16, _>("range_from") as i32,
        to: r.get::<i16, _>("range_to") as i32,
    });

    let states = sqlx::query(
        "SELECT n, step, due, streak, misses FROM verb_progress WHERE user_id = $1 ORDER BY n",
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?
    .iter()
    .map(|r| VerbStateDto {
        n: r.get::<i16, _>("n") as i32,
        step: r.get::<i16, _>("step") as i32,
        due: r.get::<chrono::NaiveDate, _>("due").format("%Y-%m-%d").to_string(),
        streak: r.get("streak"),
        misses: r.get("misses"),
    })
    .collect();

    Ok((StatusCode::OK, Json(GetVerbsStateResponse { assignment, states })))
}

/// PUT /api/verbs/assignment — учитель задаёт новую партию. Прежние глаголы
/// из states никуда не деваются: партия — отдельная запись, состояние
/// глаголов ею не затрагивается, поэтому они продолжают возвращаться на
/// повторение.
pub async fn put_verbs_assignment(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<PutAssignmentRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    if payload.from < 1 || payload.from > payload.to || payload.to > MAX_VERB_N {
        return Err(ApiError::response(
            StatusCode::BAD_REQUEST,
            format!("Партия должна лежать в границах 1..{MAX_VERB_N}, и «с» не может быть больше «по»"),
        ));
    }

    // Одним действием: партия у человека одна, и переписать её значит просто
    // заменить числа.
    sqlx::query(
        "INSERT INTO verb_assignment (user_id, range_from, range_to) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET range_from = $2, range_to = $3, updated_at = NOW()",
    )
    .bind(user_id)
    .bind(payload.from as i16)
    .bind(payload.to as i16)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/verbs/review — ответ по одному глаголу. Читает прежнюю ступень
/// (её нет — считается нулевой), считает новую и перезаписывает строку.
pub async fn post_verbs_review(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<ReviewRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    if payload.n < 1 || payload.n > MAX_VERB_N {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("Номер глагола должен быть 1..{MAX_VERB_N}")));
    }

    let existing = sqlx::query(
        "SELECT step, streak, misses FROM verb_progress WHERE user_id = $1 AND n = $2",
    )
    .bind(user_id)
    .bind(payload.n as i16)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?;

    let (step, streak, misses) = existing
        .map(|r| (r.get::<i16, _>("step") as i32, r.get::<i32, _>("streak"), r.get::<i32, _>("misses")))
        .unwrap_or((0, 0, 0));

    let today = chrono::Utc::now().date_naive();
    let next = next_verb_state(payload.n, step, streak, misses, payload.correct, today);
    let due = chrono::NaiveDate::parse_from_str(&next.due, "%Y-%m-%d")
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("дата: {e}")))?;

    // Одно обновление вместо удаления со вставкой: строка глагола опознаётся
    // ключом, а не своим содержимым, поэтому оборваться посередине нечему.
    sqlx::query(
        "INSERT INTO verb_progress (user_id, n, step, due, streak, misses)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, n) DO UPDATE
         SET step = $3, due = $4, streak = $5, misses = $6, updated_at = NOW()",
    )
    .bind(user_id)
    .bind(payload.n as i16)
    .bind(next.step as i16)
    .bind(due)
    .bind(next.streak)
    .bind(next.misses)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok((StatusCode::OK, Json(next)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn correct_answer_raises_step_and_extends_streak() {
        let today = date(2026, 9, 8);
        let s = next_verb_state(3, 1, 4, 1, true, today);
        assert_eq!(s.step, 2);
        assert_eq!(s.streak, 5);
        assert_eq!(s.misses, 1);
        // LADDER_DAYS[2] = 3
        assert_eq!(s.due, "2026-09-11");
    }

    #[test]
    fn wrong_answer_drops_one_step_not_to_zero_floor() {
        let today = date(2026, 9, 8);
        let s = next_verb_state(3, 3, 6, 0, false, today);
        assert_eq!(s.step, 2);
        assert_eq!(s.streak, 0);
        assert_eq!(s.misses, 1);
        assert_eq!(s.due, "2026-09-11"); // +3 дня
    }

    #[test]
    fn step_never_goes_below_zero() {
        let today = date(2026, 9, 8);
        let s = next_verb_state(1, 0, 0, 2, false, today);
        assert_eq!(s.step, 0);
        assert_eq!(s.misses, 3);
        assert_eq!(s.due, "2026-09-08"); // LADDER_DAYS[0] = 0 — сегодня же
    }

    #[test]
    fn step_never_goes_above_last() {
        let today = date(2026, 9, 8);
        let s = next_verb_state(1, LAST_STEP, 10, 0, true, today);
        assert_eq!(s.step, LAST_STEP);
        assert_eq!(s.streak, 11);
        assert_eq!(s.due, "2026-12-07"); // +90 дней от 8 сентября
    }

    #[test]
    fn one_miss_costs_only_one_step_after_a_solid_run() {
        // Прочный глагол на ступени 4 (SOLID_STEP), один промах — не в ноль,
        // а на ступень 3: неделя работы не должна обесцениваться одной ошибкой.
        let today = date(2026, 9, 8);
        let s = next_verb_state(7, 4, 8, 0, false, today);
        assert_eq!(s.step, 3);
    }



}
