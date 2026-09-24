// «Разговор дня»: раз в сутки короткая разговорная ситуация на 5 минут.
//
// Смысл — чтобы каждый в семье хоть немного ГОВОРИЛ каждый день. Карточки и
// упражнения тренируют узнавание, а собеседование и стройка требуют речи;
// разговор дня — самый маленький шаг, который всё равно про речь.
//
// Выбор разговора на сегодня — чистая функция (пользователь, парижская дата,
// трек), без хранения: тот же человек в тот же день на любом устройстве видит
// тот же разговор, а хранить нужно только факт выполнения
// (user_daily_challenges). Правила выбора:
//   • день — календарный по Europe/Paris (как серия в игровом слое);
//   • за последние 14 дней разговор не повторяется;
//   • трек «work» (у человека есть курс «Французский для работы» или он сам
//     попросил) — по будням рабочие ситуации, по выходным бытовые;
//     трек «general» — только бытовые.
//
// Засчитывается разговор, только если это сегодняшний разговор и человек
// действительно говорил: не меньше 4 своих реплик или 3 минут. Тогда в одной
// транзакции пишем факт и начисляем XP через игровой слой (событие
// challenge_complete: +25, идёт в серию и дневную цель, свои достижения).

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Datelike, Duration as ChronoDuration, NaiveDate, Utc, Weekday};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::VecDeque;
use uuid::Uuid;

use super::challenge_catalog::{Challenge, ChallengeKind, CATALOG};
use super::errors::ApiError;
use super::game::{self, GameUpdateDto, StudyEvent};
use crate::middleware::auth::AuthenticatedUser;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

/// Минимум, чтобы разговор считался состоявшимся. Зеркало в
/// memora-web/src/lib/challenge/rules.ts (там же кнопка «Завершить»).
pub const MIN_TURNS: i32 = 4;
pub const MIN_MINUTES: f64 = 3.0;
/// Потолок для записи: вкладку могли забыть открытой на ночь. На засчёт не
/// влияет (засчитывает минимум), только на то, что ляжет в базу.
const MAX_MINUTES: f64 = 180.0;

/// Окно без повторов. Пулы больше окна (22 бытовых, 60 рабочих), поэтому
/// кандидаты на каждый день всегда остаются.
const NO_REPEAT_DAYS: usize = 14;

/// Начало отсчёта последовательности. Разговор дня D зависит от разговоров
/// предыдущих 14 дней, те — от своих, и так до якоря; от него и идём вперёд.
/// Цена — один проход по дням с якоря (≈365 шагов по 80 элементов в год,
/// доли миллисекунды), зато никакого хранения и полная воспроизводимость.
fn anchor() -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid anchor date")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Track {
    Work,
    General,
}

impl Track {
    fn as_str(&self) -> &'static str {
        match self {
            Track::Work => "work",
            Track::General => "general",
        }
    }
}

/// Какой пул в этот день. Рабочий трек по выходным уходит в бытовые
/// ситуации: семь дней в неделю о стройке утомляют, а в субботу человек
/// всё равно идёт на рынок, а не на объект.
fn pool_for_day(track: Track, date: NaiveDate) -> ChallengeKind {
    match track {
        Track::General => ChallengeKind::General,
        Track::Work => match date.weekday() {
            Weekday::Sat | Weekday::Sun => ChallengeKind::General,
            _ => ChallengeKind::Work,
        },
    }
}

/// FNV-1a: стабилен между версиями Rust и платформами (в отличие от
/// DefaultHasher, чей алгоритм не обещан), а больше нам ничего и не нужно.
fn fnv1a(bytes: impl IntoIterator<Item = u8>) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

/// Финализатор из MurmurHash3. Без него младшие биты FNV зависят только от
/// младших битов входа, и `hash % 8` у соседних дней ходил по кругу с
/// периодом 8 — часть бытовых ситуаций не выпадала никогда.
fn fmix64(mut h: u64) -> u64 {
    h ^= h >> 33;
    h = h.wrapping_mul(0xff51_afd7_ed55_8ccd);
    h ^= h >> 33;
    h = h.wrapping_mul(0xc4ce_b9fe_1a85_ec53);
    h ^= h >> 33;
    h
}

fn day_hash(user_id: Uuid, date: NaiveDate) -> u64 {
    let day = date.num_days_from_ce().to_le_bytes();
    fmix64(fnv1a(user_id.as_bytes().iter().copied().chain(day)))
}

/// Разговор дня для человека. Детерминирован по (user_id, date, track).
pub fn pick_for_day(user_id: Uuid, date: NaiveDate, track: Track) -> &'static Challenge {
    let start = anchor().min(date);
    let mut recent: VecDeque<&'static str> = VecDeque::with_capacity(NO_REPEAT_DAYS + 1);
    let mut day = start;
    loop {
        let kind = pool_for_day(track, day);
        let fresh: Vec<&'static Challenge> = CATALOG
            .iter()
            .filter(|c| c.kind == kind && !recent.contains(&c.id))
            .collect();
        // Пустым список не бывает (пулы больше окна — см. тесты), но на
        // случай будущей правки каталога лучше повтор, чем паника.
        let candidates: Vec<&'static Challenge> = if fresh.is_empty() {
            CATALOG.iter().filter(|c| c.kind == kind).collect()
        } else {
            fresh
        };
        let pick = candidates[(day_hash(user_id, day) % candidates.len() as u64) as usize];
        if day >= date {
            return pick;
        }
        recent.push_back(pick.id);
        if recent.len() > NO_REPEAT_DAYS {
            recent.pop_front();
        }
        day += ChronoDuration::days(1);
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum CompletionError {
    UnknownChallenge,
    NotToday,
    TooShort,
    BadInput,
}

/// Проверка перед засчётом. Разговор сегодняшний, если совпадает с выбором
/// на сегодня хотя бы по одному треку: трек определяется по курсам человека
/// и мог поменяться между открытием страницы и завершением — наказывать за
/// это не хочется, а засчитать больше одного разговора в день всё равно не
/// даст первичный ключ в базе.
pub fn validate_completion(
    user_id: Uuid,
    now: DateTime<Utc>,
    challenge_id: &str,
    turns: i32,
    minutes: f64,
) -> Result<NaiveDate, CompletionError> {
    if turns < 0 || !minutes.is_finite() || minutes < 0.0 {
        return Err(CompletionError::BadInput);
    }
    if super::challenge_catalog::find(challenge_id).is_none() {
        return Err(CompletionError::UnknownChallenge);
    }
    let today = game::paris_date(now);
    let is_today = [Track::Work, Track::General]
        .iter()
        .any(|t| pick_for_day(user_id, today, *t).id == challenge_id);
    if !is_today {
        return Err(CompletionError::NotToday);
    }
    if turns < MIN_TURNS && minutes < MIN_MINUTES {
        return Err(CompletionError::TooShort);
    }
    Ok(today)
}

// ───────────────────────── Договор с фронтендом ─────────────────────────
// Зеркало в memora-web/src/lib/challenge/client.ts.

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChallengeDto {
    pub id: &'static str,
    pub kind: &'static str,
    pub level: &'static str,
    pub title: &'static str,
    pub role: &'static str,
    pub situation: &'static str,
    pub goals: &'static [&'static str],
    pub hints: &'static [&'static str],
}

impl From<&'static Challenge> for ChallengeDto {
    fn from(c: &'static Challenge) -> Self {
        ChallengeDto {
            id: c.id,
            kind: c.kind.as_str(),
            level: c.level,
            title: c.title,
            role: c.role,
            situation: c.situation,
            goals: c.goals,
            hints: c.hints,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayResponse {
    pub challenge: ChallengeDto,
    pub done: bool,
    /// Серия «Разговоров дня» подряд (своя, не общая серия занятий).
    pub streak_days: i64,
    pub track: &'static str,
    /// Парижская дата, за которую этот разговор, — фронтенду для «раз в день».
    pub date: NaiveDate,
    pub min_turns: i32,
    pub min_minutes: f64,
}

#[derive(Deserialize)]
pub struct TodayQuery {
    /// work | general. Без параметра трек определяем по курсам человека.
    pub track: Option<Track>,
}

/// Есть ли у человека курс «для работы»: свой, подписка или прогресс в нём.
/// Курс живёт в базе (custom_courses), а не в коде, поэтому ищем по названию.
async fn detect_track(pool: &PgPool, user_id: Uuid) -> Result<Track, sqlx::Error> {
    let has_work: bool = sqlx::query(
        "SELECT EXISTS (
            SELECT 1 FROM custom_courses c
            WHERE c.title ILIKE '%для работы%'
              AND (c.owner_id = $1
                   OR EXISTS (SELECT 1 FROM user_course_subscriptions s
                              WHERE s.user_id = $1 AND s.course_id = c.id::text)
                   OR EXISTS (SELECT 1 FROM course_progress p
                              WHERE p.user_id = $1 AND p.course_id = c.id::text))
         ) AS has_work",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?
    .get("has_work");
    Ok(if has_work { Track::Work } else { Track::General })
}

async fn completed_today(pool: &PgPool, user_id: Uuid, today: NaiveDate) -> Result<Option<String>, sqlx::Error> {
    Ok(sqlx::query("SELECT challenge_id FROM user_daily_challenges WHERE user_id = $1 AND challenge_date = $2")
        .bind(user_id)
        .bind(today)
        .fetch_optional(pool)
        .await?
        .map(|r| r.get::<String, _>("challenge_id")))
}

async fn challenge_streak(pool: &PgPool, user_id: Uuid, today: NaiveDate) -> Result<i64, sqlx::Error> {
    game::ensure_rows(pool, user_id).await?;
    let counters = game::load_counters(pool, user_id, false).await?;
    Ok(game::visible_challenge_streak(counters.challenge_streak, counters.last_challenge_date, today))
}

fn uid(sub: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

/// GET /api/challenge/today[?track=work|general]
pub async fn get_today(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<TodayQuery>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let today = game::paris_date(Utc::now());
    let track = match q.track {
        Some(t) => t,
        None => detect_track(&pool, user_id).await.map_err(db_err)?,
    };

    // Если сегодня уже поговорили — показываем ИМЕННО тот разговор, даже если
    // трек с тех пор сменился: «выполнено» под чужой карточкой сбивало бы.
    let done_id = completed_today(&pool, user_id, today).await.map_err(db_err)?;
    let challenge = done_id
        .as_deref()
        .and_then(super::challenge_catalog::find)
        .unwrap_or_else(|| pick_for_day(user_id, today, track));

    Ok(Json(TodayResponse {
        challenge: ChallengeDto::from(challenge),
        done: done_id.is_some(),
        streak_days: challenge_streak(&pool, user_id, today).await.map_err(db_err)?,
        track: track.as_str(),
        date: today,
        min_turns: MIN_TURNS,
        min_minutes: MIN_MINUTES,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteRequest {
    pub challenge_id: String,
    pub turns: i32,
    pub minutes: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteResponse {
    /// true — сегодня уже засчитано раньше (двойной тап, второе устройство);
    /// тогда update пустой и XP повторно не начисляется.
    pub already_done: bool,
    pub update: Option<GameUpdateDto>,
    pub streak_days: i64,
}

/// POST /api/challenge/complete
pub async fn complete(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<CompleteRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let now = Utc::now();
    let today = validate_completion(user_id, now, &req.challenge_id, req.turns, req.minutes).map_err(|e| match e {
        CompletionError::BadInput => ApiError::response(StatusCode::BAD_REQUEST, "Некорректные данные разговора"),
        CompletionError::UnknownChallenge => ApiError::response(StatusCode::NOT_FOUND, "Такого разговора нет"),
        CompletionError::NotToday => ApiError::response(
            StatusCode::CONFLICT,
            "Это не сегодняшний разговор — обновите страницу",
        ),
        CompletionError::TooShort => ApiError::response(
            StatusCode::UNPROCESSABLE_ENTITY,
            format!("Поговорите ещё немного: нужно хотя бы {MIN_TURNS} реплики или {} минуты", MIN_MINUTES as i32),
        ),
    })?;

    game::ensure_rows(&pool, user_id).await.map_err(db_err)?;
    let mut tx = pool.begin().await.map_err(db_err)?;

    let inserted = sqlx::query(
        "INSERT INTO user_daily_challenges (user_id, challenge_date, challenge_id, turns, minutes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, challenge_date) DO NOTHING
         RETURNING challenge_id",
    )
    .bind(user_id)
    .bind(today)
    .bind(&req.challenge_id)
    .bind(req.turns)
    .bind(req.minutes.min(MAX_MINUTES))
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_err)?;

    if inserted.is_none() {
        tx.rollback().await.map_err(db_err)?;
        return Ok(Json(CompleteResponse {
            already_done: true,
            update: None,
            streak_days: challenge_streak(&pool, user_id, today).await.map_err(db_err)?,
        }));
    }

    let event = StudyEvent::ChallengeComplete {
        challenge_id: req.challenge_id.clone(),
        turns: req.turns,
        minutes: req.minutes,
    };
    let update = game::award_event_in_tx(&mut tx, user_id, &event, now).await.map_err(db_err)?;
    tx.commit().await.map_err(db_err)?;

    Ok(Json(CompleteResponse {
        already_done: false,
        update: Some(update),
        streak_days: challenge_streak(&pool, user_id, today).await.map_err(db_err)?,
    }))
}

// ───────────────────────────────── Тесты ─────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn ymd(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }
    fn utc(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        ymd(y, m, d).and_hms_opt(h, min, 0).unwrap().and_utc()
    }
    fn user(n: u8) -> Uuid {
        Uuid::from_bytes([n; 16])
    }

    // ---------- Детерминированный выбор ----------

    #[test]
    fn same_user_same_day_same_challenge() {
        let d = ymd(2026, 9, 24);
        for t in [Track::Work, Track::General] {
            assert_eq!(pick_for_day(user(1), d, t).id, pick_for_day(user(1), d, t).id);
        }
    }

    #[test]
    fn different_users_get_different_sequences() {
        // Не обязано отличаться каждый день, но за месяц последовательности
        // двух людей не должны совпасть целиком — иначе хэш не смешивает id.
        let mut differs = 0;
        let mut d = ymd(2026, 9, 1);
        for _ in 0..30 {
            if pick_for_day(user(1), d, Track::Work).id != pick_for_day(user(2), d, Track::Work).id {
                differs += 1;
            }
            d += ChronoDuration::days(1);
        }
        assert!(differs > 15, "совпало слишком много дней: отличий всего {differs}");
    }

    #[test]
    fn hash_is_stable_across_builds() {
        // Зафиксированное значение: если поменяется функция хэша, у всей
        // семьи молча сменятся разговоры дня (и «выполнено» перестанет
        // совпадать с показанным). Такое изменение должно быть осознанным.
        // Эталонные векторы FNV-1a 64.
        assert_eq!(fnv1a(*b""), 0xcbf2_9ce4_8422_2325);
        assert_eq!(fnv1a(*b"a"), 0xaf63_dc4c_8601_ec8c);
        assert_eq!(fnv1a(*b"foobar"), 0x8594_4171_f739_67e8);
        assert_ne!(day_hash(user(1), ymd(2026, 9, 24)), day_hash(user(1), ymd(2026, 9, 25)));
        assert_ne!(day_hash(user(1), ymd(2026, 9, 24)), day_hash(user(2), ymd(2026, 9, 24)));
    }

    // ---------- Окно без повторов ----------

    fn assert_no_repeat_window(u: Uuid, track: Track, from: NaiveDate, days: i64) {
        let seq: Vec<&str> = (0..days)
            .map(|i| pick_for_day(u, from + ChronoDuration::days(i), track).id)
            .collect();
        for (i, id) in seq.iter().enumerate() {
            let lo = i.saturating_sub(NO_REPEAT_DAYS);
            assert!(
                !seq[lo..i].contains(id),
                "{id} повторился в пределах {NO_REPEAT_DAYS} дней (день {i}, трек {track:?})"
            );
        }
    }

    #[test]
    fn no_repeat_within_14_days_general_track() {
        for n in 1..=5 {
            assert_no_repeat_window(user(n), Track::General, ymd(2026, 1, 1), 300);
        }
    }

    #[test]
    fn no_repeat_within_14_days_work_track() {
        for n in 1..=5 {
            assert_no_repeat_window(user(n), Track::Work, ymd(2026, 1, 1), 300);
        }
    }

    #[test]
    fn pools_are_larger_than_the_window() {
        // Иначе на какой-то день не останется «свежих» кандидатов.
        for kind in [ChallengeKind::Work, ChallengeKind::General] {
            let n = CATALOG.iter().filter(|c| c.kind == kind).count();
            assert!(n > NO_REPEAT_DAYS, "{kind:?}: {n}");
        }
    }

    #[test]
    fn whole_general_pool_gets_used() {
        // Не залипаем на подмножестве: за 120 дней бытовой трек проходит
        // по всему пулу.
        let mut seen = std::collections::HashSet::new();
        for i in 0..120 {
            seen.insert(pick_for_day(user(3), ymd(2026, 3, 1) + ChronoDuration::days(i), Track::General).id);
        }
        let pool = CATALOG.iter().filter(|c| c.kind == ChallengeKind::General).count();
        assert_eq!(seen.len(), pool);
    }

    #[test]
    fn work_track_is_work_on_weekdays_general_on_weekends() {
        let mut d = ymd(2026, 9, 21); // понедельник
        for _ in 0..14 {
            let c = pick_for_day(user(4), d, Track::Work);
            let weekend = matches!(d.weekday(), Weekday::Sat | Weekday::Sun);
            assert_eq!(c.kind, if weekend { ChallengeKind::General } else { ChallengeKind::Work }, "{d}");
            d += ChronoDuration::days(1);
        }
    }

    #[test]
    fn general_track_never_gets_work_items() {
        let mut d = ymd(2026, 9, 1);
        for _ in 0..60 {
            assert_eq!(pick_for_day(user(5), d, Track::General).kind, ChallengeKind::General);
            d += ChronoDuration::days(1);
        }
    }

    #[test]
    fn dates_before_anchor_still_work() {
        let c = pick_for_day(user(1), ymd(2025, 12, 31), Track::General);
        assert_eq!(c.kind, ChallengeKind::General);
    }

    // ---------- Проверка завершения ----------

    #[test]
    fn accepts_todays_challenge_with_enough_turns() {
        let now = utc(2026, 9, 24, 10, 0);
        let today = game::paris_date(now);
        let id = pick_for_day(user(1), today, Track::Work).id;
        assert_eq!(validate_completion(user(1), now, id, 4, 0.5), Ok(today));
    }

    #[test]
    fn accepts_enough_minutes_even_with_few_turns() {
        let now = utc(2026, 9, 24, 10, 0);
        let id = pick_for_day(user(1), game::paris_date(now), Track::General).id;
        assert!(validate_completion(user(1), now, id, 1, 3.0).is_ok());
    }

    #[test]
    fn rejects_too_short_conversation() {
        let now = utc(2026, 9, 24, 10, 0);
        let id = pick_for_day(user(1), game::paris_date(now), Track::Work).id;
        assert_eq!(validate_completion(user(1), now, id, 3, 2.9), Err(CompletionError::TooShort));
    }

    #[test]
    fn rejects_someone_elses_or_other_days_challenge() {
        let now = utc(2026, 9, 24, 10, 0);
        let today = game::paris_date(now);
        let mine = [pick_for_day(user(1), today, Track::Work).id, pick_for_day(user(1), today, Track::General).id];
        let other = CATALOG.iter().find(|c| !mine.contains(&c.id)).unwrap().id;
        assert_eq!(validate_completion(user(1), now, other, 10, 5.0), Err(CompletionError::NotToday));
    }

    #[test]
    fn rejects_unknown_and_malformed_input() {
        let now = utc(2026, 9, 24, 10, 0);
        let id = pick_for_day(user(1), game::paris_date(now), Track::Work).id;
        assert_eq!(validate_completion(user(1), now, "nope", 10, 5.0), Err(CompletionError::UnknownChallenge));
        assert_eq!(validate_completion(user(1), now, id, -1, 5.0), Err(CompletionError::BadInput));
        assert_eq!(validate_completion(user(1), now, id, 5, f64::NAN), Err(CompletionError::BadInput));
        assert_eq!(validate_completion(user(1), now, id, 5, -1.0), Err(CompletionError::BadInput));
    }

    // ---------- Границы парижских суток ----------

    #[test]
    fn paris_midnight_switches_the_challenge_summer() {
        // Пятница 10 июля 2026, лето (UTC+2). 21:59 UTC = 23:59 в Париже —
        // ещё пятница; 22:01 UTC = 00:01 субботы. Рабочий трек в пятницу даёт
        // рабочую ситуацию, в субботу оба трека — бытовые, поэтому пятничный
        // разговор после парижской полуночи уже не сегодняшний.
        let before = utc(2026, 7, 10, 21, 59);
        let after = utc(2026, 7, 10, 22, 1);
        assert_eq!(game::paris_date(before), ymd(2026, 7, 10));
        assert_eq!(game::paris_date(after), ymd(2026, 7, 11));
        let friday = pick_for_day(user(1), ymd(2026, 7, 10), Track::Work);
        assert_eq!(friday.kind, ChallengeKind::Work);
        assert!(validate_completion(user(1), before, friday.id, 5, 5.0).is_ok());
        assert_eq!(validate_completion(user(1), after, friday.id, 5, 5.0), Err(CompletionError::NotToday));
    }

    #[test]
    fn paris_midnight_switches_the_challenge_winter() {
        // Пятница 15 января 2027, зима (UTC+1): граница — 23:00 UTC.
        let before = utc(2027, 1, 15, 22, 59);
        let after = utc(2027, 1, 15, 23, 1);
        assert_eq!(game::paris_date(before), ymd(2027, 1, 15));
        assert_eq!(game::paris_date(after), ymd(2027, 1, 16));
        let friday = pick_for_day(user(2), ymd(2027, 1, 15), Track::Work);
        assert!(validate_completion(user(2), before, friday.id, 5, 5.0).is_ok());
        assert_eq!(validate_completion(user(2), after, friday.id, 5, 5.0), Err(CompletionError::NotToday));
    }

    #[test]
    fn late_evening_utc_is_already_tomorrow_in_paris() {
        // 22:30 UTC 23 сентября — в Париже уже 00:30 24-го: разговор 24-го.
        let now = utc(2026, 9, 23, 22, 30);
        let id = pick_for_day(user(3), ymd(2026, 9, 24), Track::General).id;
        assert_eq!(validate_completion(user(3), now, id, 5, 5.0), Ok(ymd(2026, 9, 24)));
    }

    #[test]
    fn today_response_shape() {
        let v = serde_json::to_value(TodayResponse {
            challenge: ChallengeDto::from(&CATALOG[0]),
            done: false,
            streak_days: 2,
            track: "work",
            date: ymd(2026, 9, 24),
            min_turns: MIN_TURNS,
            min_minutes: MIN_MINUTES,
        })
        .unwrap();
        for key in ["challenge", "done", "streakDays", "track", "date", "minTurns", "minMinutes"] {
            assert!(v.get(key).is_some(), "нет поля {key}");
        }
        assert_eq!(v["date"], "2026-09-24");
        for key in ["id", "kind", "level", "title", "role", "situation", "goals", "hints"] {
            assert!(v["challenge"].get(key).is_some(), "нет поля challenge.{key}");
        }
        let q: TodayQuery = serde_json::from_str(r#"{"track":"work"}"#).unwrap();
        assert_eq!(q.track, Some(Track::Work));
    }
}
