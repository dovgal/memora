// Игровой слой: XP, уровни, ежедневная серия с заморозками, дневная цель,
// достижения, семейное табло. Контракт с фронтендом — StudyEvent/GameUpdate/
// Achievement в memora-web/src/lib/game/client.ts; менять поля тут нужно
// синхронно с той стороной.
//
// XP считает СЕРВЕР — клиенту не доверяем (ровно как в classes::submit_xp,
// только тут не «максимум из присланного», а собственная арифметика с
// антифрод-лимитами на событие и на минуту). Серия дней — по календарной
// дате Europe/Paris (это где живёт семья), а не по UTC: иначе полночь по
// UTC рвала бы серию посреди вечера.
//
// Правила начисления (см. также #[cfg(test)] в конце файла):
//   answer:            верно с первой попытки 10, иначе 5, + бонус за комбо
//                       (до +5), итог ограничен сверху 15.
//   pronunciation:      оценка ≥0.8 → 8, ≥0.5 → 3 (частичная попытка тоже
//                       чего-то стоит), иначе 0.
//   sentence_built:     верно построенная фраза — 15.
//   exercise_complete:  5 (упражнение целиком, а не отдельный ответ).
//   session_complete:   20 + 15 за безошибочную сессию (cards>0 && correct>=cards).
//   challenge_complete: 25 за «Разговор дня». Приходит НЕ с клиента напрямую,
//                       а из handlers::challenge после проверки, что это
//                       сегодняшний разговор и человек действительно говорил;
//                       поэтому минутный лимит его не режет (раз в день и так).
// Плюс общий потолок на одно событие (MAX_XP_PER_EVENT) и на минуту
// (MINUTE_XP_CAP) — защита от скриптованного спама одним и тем же событием.

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Datelike, Duration as ChronoDuration, NaiveDate, Timelike, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashSet;
use uuid::Uuid;

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

fn uid(sub: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

// ───────────────────────── Договор с фронтендом ─────────────────────────
// Зеркало StudySource/StudyEvent/Achievement/GameUpdate из lib/game/client.ts.

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StudySource {
    Flashcards,
    Course,
    Reader,
    Verbs,
    Challenge,
}

impl StudySource {
    fn as_str(&self) -> &'static str {
        match self {
            StudySource::Flashcards => "flashcards",
            StudySource::Course => "course",
            StudySource::Reader => "reader",
            StudySource::Verbs => "verbs",
            StudySource::Challenge => "challenge",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum StudyEvent {
    Answer { source: StudySource, correct: bool, first_try: bool, combo: i32 },
    Pronunciation { source: StudySource, score: f64 },
    SentenceBuilt { source: StudySource, correct: bool },
    ExerciseComplete { source: StudySource },
    SessionComplete { source: StudySource, cards: i32, correct: i32, minutes: f64 },
    /// «Разговор дня» завершён. Своего `source` нет — источник один.
    /// Поля описательные (сервер их уже проверил в handlers::challenge).
    ChallengeComplete { challenge_id: String, turns: i32, minutes: f64 },
}

impl StudyEvent {
    fn source(&self) -> StudySource {
        match self {
            StudyEvent::Answer { source, .. }
            | StudyEvent::Pronunciation { source, .. }
            | StudyEvent::SentenceBuilt { source, .. }
            | StudyEvent::ExerciseComplete { source, .. }
            | StudyEvent::SessionComplete { source, .. } => *source,
            StudyEvent::ChallengeComplete { .. } => StudySource::Challenge,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct AchievementDto {
    pub id: String,
    pub title: String,
    pub description: String,
    pub emoji: String,
}

impl From<&AchievementDef> for AchievementDto {
    fn from(a: &AchievementDef) -> Self {
        AchievementDto {
            id: a.id.to_string(),
            title: a.title.to_string(),
            description: a.description.to_string(),
            emoji: a.emoji.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameUpdateDto {
    pub xp: i64,
    pub xp_gained: i64,
    pub level: i64,
    pub leveled_up: bool,
    pub streak_days: i64,
    pub daily_goal: i64,
    pub daily_progress: i64,
    pub new_achievements: Vec<AchievementDto>,
}

// ───────────────────────── Каталог достижений ─────────────────────────
// ~15 штук, зашиты в коде (не в БД) — семье их не редактировать, а тексту
// проще жить рядом с правилом разблокировки, чем в отдельной таблице.

pub struct AchievementDef {
    pub id: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub emoji: &'static str,
}

pub const ACHIEVEMENTS: &[AchievementDef] = &[
    AchievementDef { id: "first_session", title: "Первый шаг", description: "Завершите первую сессию занятий.", emoji: "🎉" },
    AchievementDef { id: "streak_3", title: "Втянулись", description: "Занимайтесь 3 дня подряд.", emoji: "🔥" },
    AchievementDef { id: "streak_7", title: "Неделя без пропусков", description: "Занимайтесь 7 дней подряд.", emoji: "🔥" },
    AchievementDef { id: "streak_30", title: "Железная привычка", description: "Занимайтесь 30 дней подряд.", emoji: "🏆" },
    AchievementDef { id: "correct_100", title: "Сто верных", description: "Дайте 100 правильных ответов.", emoji: "✅" },
    AchievementDef { id: "correct_500", title: "Пятьсот верных", description: "Дайте 500 правильных ответов.", emoji: "⭐" },
    AchievementDef { id: "perfect_session", title: "Без единой ошибки", description: "Завершите сессию без единой ошибки.", emoji: "💯" },
    AchievementDef { id: "pronunciation_10", title: "Хорошее произношение", description: "10 раз получите хорошую оценку произношения.", emoji: "🗣️" },
    AchievementDef { id: "sentences_10", title: "Строитель фраз", description: "Постройте 10 верных предложений.", emoji: "🧩" },
    AchievementDef { id: "early_bird", title: "Жаворонок", description: "Позанимайтесь рано утром, с 5 до 7.", emoji: "🌅" },
    AchievementDef { id: "night_owl", title: "Сова", description: "Позанимайтесь поздно вечером, после 22:00.", emoji: "🌙" },
    AchievementDef { id: "comeback", title: "С возвращением", description: "Вернитесь к занятиям после перерыва от недели.", emoji: "👋" },
    AchievementDef { id: "daily_goal_5", title: "Пять дней по плану", description: "Выполняйте дневную цель 5 дней подряд.", emoji: "🎯" },
    AchievementDef { id: "level_10", title: "Десятый уровень", description: "Достигните 10-го уровня.", emoji: "🚀" },
    AchievementDef { id: "xp_1000", title: "Тысяча опыта", description: "Наберите 1000 очков опыта за всё время.", emoji: "💎" },
    AchievementDef { id: "talkative", title: "Разговорчивый", description: "Проведите 7 «Разговоров дня».", emoji: "💬" },
    AchievementDef { id: "talk_week", title: "Неделя разговоров", description: "Проводите «Разговор дня» 7 дней подряд.", emoji: "🗓️" },
];

/// Снимок состояния ПОСЛЕ обработки события — из него решаем, что разблокировалось.
/// Кумулятивные поля берём из счётчиков, «разовые» (ранняя пташка, камбэк,
/// безошибочная сессия) — из результата обработки конкретного события.
struct AchievementContext {
    total_sessions: i64,
    streak_days: i64,
    total_correct: i64,
    perfect_sessions: i64,
    good_pronunciations: i64,
    sentences_built: i64,
    is_early_bird: bool,
    is_night_owl: bool,
    comeback: bool,
    daily_goal_streak: i64,
    level: i64,
    xp: i64,
    challenges_completed: i64,
    challenge_streak: i64,
}

fn qualifies(id: &str, ctx: &AchievementContext) -> bool {
    match id {
        "first_session" => ctx.total_sessions >= 1,
        "streak_3" => ctx.streak_days >= 3,
        "streak_7" => ctx.streak_days >= 7,
        "streak_30" => ctx.streak_days >= 30,
        "correct_100" => ctx.total_correct >= 100,
        "correct_500" => ctx.total_correct >= 500,
        "perfect_session" => ctx.perfect_sessions >= 1,
        "pronunciation_10" => ctx.good_pronunciations >= 10,
        "sentences_10" => ctx.sentences_built >= 10,
        "early_bird" => ctx.is_early_bird,
        "night_owl" => ctx.is_night_owl,
        "comeback" => ctx.comeback,
        "daily_goal_5" => ctx.daily_goal_streak >= 5,
        "level_10" => ctx.level >= 10,
        "xp_1000" => ctx.xp >= 1000,
        "talkative" => ctx.challenges_completed >= 7,
        "talk_week" => ctx.challenge_streak >= 7,
        _ => false,
    }
}

fn newly_unlocked<'a>(ctx: &AchievementContext, already: &HashSet<String>) -> Vec<&'a AchievementDef> {
    ACHIEVEMENTS.iter().filter(|a| !already.contains(a.id) && qualifies(a.id, ctx)).collect()
}

// ───────────────────────── Календарь Europe/Paris ─────────────────────────
// chrono-tz в зависимостях нет — а правило DST ЕС не менялось десятилетиями
// (последнее воскресенье марта 01:00 UTC → CEST +2, последнее воскресенье
// октября 01:00 UTC → CET +1), так что считаем руками и покрываем тестами
// сами переходы и полночь по Парижу.

fn last_sunday(year: i32, month: u32) -> NaiveDate {
    let (next_year, next_month) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let first_of_next = NaiveDate::from_ymd_opt(next_year, next_month, 1).expect("valid calendar month");
    let last_of_month = first_of_next - ChronoDuration::days(1);
    let since_sunday = last_of_month.weekday().num_days_from_sunday();
    last_of_month - ChronoDuration::days(since_sunday as i64)
}

fn paris_offset_minutes(dt: DateTime<Utc>) -> i64 {
    let year = dt.year();
    let spring = last_sunday(year, 3).and_hms_opt(1, 0, 0).expect("valid time").and_utc();
    let autumn = last_sunday(year, 10).and_hms_opt(1, 0, 0).expect("valid time").and_utc();
    if dt >= spring && dt < autumn { 120 } else { 60 }
}

pub(crate) fn paris_date(dt: DateTime<Utc>) -> NaiveDate {
    (dt + ChronoDuration::minutes(paris_offset_minutes(dt))).date_naive()
}

fn paris_hour(dt: DateTime<Utc>) -> u32 {
    (dt + ChronoDuration::minutes(paris_offset_minutes(dt))).hour()
}

// ───────────────────────── Уровни ─────────────────────────
// Квадратичный порог: пороги растут с уровнем, поэтому прогресс быстрый в
// начале (100–150 XP на первые уровни) и всё дороже дальше — как и просили.

fn xp_for_next_level(level: i64) -> i64 {
    100 + 15 * level * level
}

/// (уровень, XP внутри текущего уровня, XP, нужный для следующего).
fn level_progress(total_xp: i64) -> (i64, i64, i64) {
    let mut level = 1i64;
    let mut remaining = total_xp.max(0);
    loop {
        let need = xp_for_next_level(level);
        if remaining < need || level >= 9999 {
            return (level, remaining, need);
        }
        remaining -= need;
        level += 1;
    }
}

fn level_for_xp(total_xp: i64) -> i64 {
    level_progress(total_xp).0
}

// ───────────────────────── Начисление XP и анти-фрод ─────────────────────────

const MAX_XP_PER_EVENT: i64 = 40;
// Живой темп на карточках — 8–12 ответов в минуту по 10–15 XP, плюс финал
// сессии. Потолок чуть выше этого, чтобы быстрый честный ученик в него не
// упирался (и не терял бонус за сессию), а скрипт с десятками событий в
// секунду — упирался.
const MINUTE_XP_CAP: i64 = 180;

/// Окна для «жаворонка» и «совы» по парижскому часу. Оба — ДО полуночи и
/// ПОСЛЕ пяти утра: в семье есть дети, награждать занятия в час ночи не хотим.
fn is_early_bird_hour(hour: u32) -> bool {
    (5..7).contains(&hour)
}

fn is_night_owl_hour(hour: u32) -> bool {
    hour >= 22
}

/// База начисления по правилам из шапки файла + попутное обновление
/// «сырых» счётчиков действий (не XP, а факта: сколько раз что случилось —
/// нужно достижениям вроде «100 верных ответов»).
fn compute_event_xp(event: &StudyEvent, counters: &mut CountersCore) -> i64 {
    match event {
        StudyEvent::Answer { correct, first_try, combo, .. } => {
            if !*correct {
                return 0;
            }
            counters.total_correct += 1;
            let base = if *first_try { 10 } else { 5 };
            let combo_bonus = (*combo).clamp(0, 5) as i64;
            base + combo_bonus
        }
        StudyEvent::Pronunciation { score, .. } => {
            if *score >= 0.8 {
                counters.good_pronunciations += 1;
                8
            } else if *score >= 0.5 {
                3
            } else {
                0
            }
        }
        StudyEvent::SentenceBuilt { correct, .. } => {
            if *correct {
                counters.sentences_built += 1;
                15
            } else {
                0
            }
        }
        StudyEvent::ExerciseComplete { .. } => 5,
        StudyEvent::SessionComplete { cards, correct, minutes: _minutes, .. } => {
            // Длительность (minutes) сейчас не влияет на начисление — в
            // контракте она описательная; будет нужна, если появится
            // минимальный порог «сессия короче N секунд не считается».
            counters.total_sessions += 1;
            let perfect = *cards > 0 && *correct >= *cards;
            if perfect {
                counters.perfect_sessions += 1;
            }
            20 + if perfect { 15 } else { 0 }
        }
        StudyEvent::ChallengeComplete { challenge_id: _id, turns: _turns, minutes: _minutes } => {
            // Порог «4 реплики или 3 минуты» уже проверил handlers::challenge;
            // здесь поля описательные — начисление за разговор фиксированное.
            counters.challenges_completed += 1;
            CHALLENGE_XP
        }
    }
}

pub(crate) const CHALLENGE_XP: i64 = 25;

/// Серия «Разговоров дня» — отдельная от общей серии: общую держит любое
/// занятие, а эта про привычку говорить. Заморозок здесь нет — ачивка
/// «Неделя разговоров» должна значить ровно семь разговоров подряд.
fn apply_challenge_streak(counters: &mut CountersCore, today: NaiveDate) {
    match counters.last_challenge_date {
        Some(d) if d >= today => {}
        Some(d) if d == today - ChronoDuration::days(1) => {
            counters.challenge_streak += 1;
            counters.last_challenge_date = Some(today);
        }
        _ => {
            counters.challenge_streak = 1;
            counters.last_challenge_date = Some(today);
        }
    }
}

/// Серия разговоров «как её видит человек сейчас»: живая, если последний
/// разговор был сегодня или вчера (сегодня ещё можно продолжить).
pub(crate) fn visible_challenge_streak(streak: i64, last: Option<NaiveDate>, today: NaiveDate) -> i64 {
    match last {
        Some(d) if (today - d).num_days() <= 1 => streak,
        _ => 0,
    }
}

/// Лимит «не больше MINUTE_XP_CAP очков за 60 секунд»: скользящее окно упрощено
/// до фиксированной корзины — она открывается первым событием и живёт минуту.
fn apply_minute_cap(stats: &mut StatsCore, now: DateTime<Utc>, raw_xp: i64) -> i64 {
    let bucket_active = stats
        .minute_bucket
        .map(|b| now.signed_duration_since(b) < ChronoDuration::seconds(60))
        .unwrap_or(false);
    if !bucket_active {
        stats.minute_bucket = Some(now);
        stats.minute_xp = 0;
    }
    let allowed = (MINUTE_XP_CAP - stats.minute_xp).max(0);
    let awarded = raw_xp.clamp(0, allowed);
    stats.minute_xp += awarded;
    awarded
}

fn maybe_grant_freeze(stats: &mut StatsCore) {
    // 1 заморозка за каждые 7 дней серии, не больше 2 про запас —
    // иначе штраф за один пропущенный день теряет смысл.
    if stats.streak_days > 0 && stats.streak_days % 7 == 0 {
        stats.freezes = (stats.freezes + 1).min(2);
    }
}

/// Серия дней по календарю Europe/Paris. Возвращает true, если это
/// возвращение после перерыва от недели и больше (для ачивки «comeback»).
fn apply_streak(stats: &mut StatsCore, today: NaiveDate) -> bool {
    let mut comeback = false;
    match stats.last_active_date {
        // d > today — часы устройства/сервера съехали назад; ведём себя как
        // «уже отметились сегодня», чтобы не оборвать серию на ровном месте.
        Some(d) if d >= today => {
            // Уже отметились сегодня — второе событие в тот же день серию не двигает.
        }
        Some(d) if d == today - ChronoDuration::days(1) => {
            stats.streak_days += 1;
            stats.longest_streak = stats.longest_streak.max(stats.streak_days);
            maybe_grant_freeze(stats);
            stats.last_active_date = Some(today);
        }
        Some(d) => {
            let gap_days = (today - d).num_days();
            let missed_days = gap_days - 1;
            if missed_days == 1 && stats.freezes > 0 {
                // Пропущен ровно один день, и есть заморозка — она его гасит,
                // серия идёт дальше, будто пропуска не было.
                stats.freezes -= 1;
                stats.streak_days += 1;
                stats.longest_streak = stats.longest_streak.max(stats.streak_days);
                maybe_grant_freeze(stats);
            } else {
                comeback = gap_days >= 7 && stats.streak_days > 0;
                stats.streak_days = 1;
            }
            stats.last_active_date = Some(today);
        }
        None => {
            stats.streak_days = 1;
            stats.longest_streak = stats.longest_streak.max(1);
            stats.last_active_date = Some(today);
        }
    }
    comeback
}

/// Серия «как её видит человек сейчас». В БД streak_days обновляется только
/// событием, поэтому после недели тишины там всё ещё лежит старое число — а
/// показывать в шапке «🔥 12», когда серия уже сгорела, нечестно. Живой
/// считаем серию, если занимались сегодня/вчера или пропущен ровно один день
/// и есть заморозка (её спишет первое же событие).
fn visible_streak(streak_days: i64, last_active: Option<NaiveDate>, freezes: i64, today: NaiveDate) -> i64 {
    match last_active {
        Some(d) if (today - d).num_days() <= 1 => streak_days,
        Some(d) if (today - d).num_days() == 2 && freezes > 0 => streak_days,
        _ => 0,
    }
}

/// Дневная цель: сброс на новый календарный день + счётчик «сколько дней
/// подряд цель выполнена» (для ачивки daily_goal_5). Стрик цели живёт в
/// counters, а не в stats — он про поведение, а не про XP.
///
/// Фоновой задачи «конец дня» нет, поэтому судьба дня узнаётся только со
/// следующим событием: пока день открыт, серия хранит вчерашний исход;
/// разрыв обнаруживается на первом событии СЛЕДУЮЩЕГО дня, когда мы
/// оглядываемся на только что закрывшийся день. Тот же принцип, что и у
/// apply_streak — здесь предсказуемо задержан на одно событие.
fn apply_daily_goal(stats: &mut StatsCore, counters: &mut CountersCore, today: NaiveDate, xp_gained: i64) {
    match stats.daily_date {
        Some(d) if d == today => {}
        Some(d) if d == today - ChronoDuration::days(1) => {
            if stats.daily_xp < stats.daily_goal {
                counters.daily_goal_streak = 0;
            }
            stats.daily_xp = 0;
            stats.daily_date = Some(today);
        }
        _ => {
            // Первый день или дыра в две и более — прошлое не считается «подряд».
            counters.daily_goal_streak = 0;
            stats.daily_xp = 0;
            stats.daily_date = Some(today);
        }
    }
    let was_met = stats.daily_xp >= stats.daily_goal;
    stats.daily_xp += xp_gained;
    let now_met = stats.daily_xp >= stats.daily_goal;
    if now_met && !was_met {
        counters.daily_goal_streak += 1;
    }
}

// ───────────────────────── Состояние (без sqlx — для чистых тестов) ─────────────────────────

#[derive(Debug, Clone)]
struct StatsCore {
    xp: i64,
    level: i64,
    streak_days: i64,
    longest_streak: i64,
    freezes: i64,
    last_active_date: Option<NaiveDate>,
    daily_goal: i64,
    daily_xp: i64,
    daily_date: Option<NaiveDate>,
    minute_bucket: Option<DateTime<Utc>>,
    minute_xp: i64,
}

impl Default for StatsCore {
    fn default() -> Self {
        StatsCore {
            xp: 0,
            level: 1,
            streak_days: 0,
            longest_streak: 0,
            freezes: 0,
            last_active_date: None,
            daily_goal: 50,
            daily_xp: 0,
            daily_date: None,
            minute_bucket: None,
            minute_xp: 0,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct CountersCore {
    total_correct: i64,
    total_sessions: i64,
    perfect_sessions: i64,
    good_pronunciations: i64,
    sentences_built: i64,
    daily_goal_streak: i64,
    pub(crate) challenges_completed: i64,
    pub(crate) challenge_streak: i64,
    pub(crate) last_challenge_date: Option<NaiveDate>,
}

struct EventOutcome {
    xp_gained: i64,
    leveled_up: bool,
    new_achievements: Vec<&'static AchievementDef>,
}

/// Единая точка правил — обновляет stats/counters «на месте» и решает, что
/// разблокировалось. Чистая функция (никакого sqlx), поэтому вся сложная
/// арифметика тестируется без БД — см. #[cfg(test)] ниже.
fn apply_event(
    stats: &mut StatsCore,
    counters: &mut CountersCore,
    already_unlocked: &HashSet<String>,
    event: &StudyEvent,
    now: DateTime<Utc>,
) -> EventOutcome {
    let today = paris_date(now);
    let old_level = level_for_xp(stats.xp);

    let raw_xp = compute_event_xp(event, counters).min(MAX_XP_PER_EVENT);
    let is_challenge = matches!(event, StudyEvent::ChallengeComplete { .. });
    // Разговор дня ограничен «раз в день» первичным ключом в БД, а минутный
    // лимит — защита от скриптованного спама с клиента. Если человек только
    // что пролистал колоду и упёрся в лимит, честные 25 XP за разговор не
    // должны сгореть.
    let xp_gained = if is_challenge { raw_xp } else { apply_minute_cap(stats, now, raw_xp) };
    if is_challenge {
        apply_challenge_streak(counters, today);
    }

    let comeback = apply_streak(stats, today);
    apply_daily_goal(stats, counters, today, xp_gained);

    stats.xp += xp_gained;
    stats.level = level_for_xp(stats.xp);
    let leveled_up = stats.level > old_level;

    let hour = paris_hour(now);
    let ctx = AchievementContext {
        total_sessions: counters.total_sessions,
        streak_days: stats.streak_days,
        total_correct: counters.total_correct,
        perfect_sessions: counters.perfect_sessions,
        good_pronunciations: counters.good_pronunciations,
        sentences_built: counters.sentences_built,
        is_early_bird: is_early_bird_hour(hour),
        is_night_owl: is_night_owl_hour(hour),
        comeback,
        daily_goal_streak: counters.daily_goal_streak,
        level: stats.level,
        xp: stats.xp,
        challenges_completed: counters.challenges_completed,
        challenge_streak: counters.challenge_streak,
    };
    let new_achievements = newly_unlocked(&ctx, already_unlocked);

    EventOutcome { xp_gained, leveled_up, new_achievements }
}

// ───────────────────────── DB ↔ StatsCore/CountersCore ─────────────────────────

pub(crate) async fn ensure_rows(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO user_game_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .execute(pool)
        .await?;
    sqlx::query("INSERT INTO user_game_counters (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// `lock=true` берёт строку под FOR UPDATE — используем внутри транзакции
/// report_event, чтобы два параллельных события того же человека (двойной тап,
/// два устройства разом) не потеряли одно из начислений при read-modify-write.
async fn load_stats<'c, E>(exec: E, user_id: Uuid, lock: bool) -> Result<StatsCore, sqlx::Error>
where
    E: sqlx::PgExecutor<'c>,
{
    let sql = if lock {
        "SELECT xp, level, streak_days, longest_streak, freezes, last_active_date,
                daily_goal, daily_xp, daily_date, minute_bucket, minute_xp
         FROM user_game_stats WHERE user_id = $1 FOR UPDATE"
    } else {
        "SELECT xp, level, streak_days, longest_streak, freezes, last_active_date,
                daily_goal, daily_xp, daily_date, minute_bucket, minute_xp
         FROM user_game_stats WHERE user_id = $1"
    };
    let row = sqlx::query(sql).bind(user_id).fetch_one(exec).await?;
    Ok(StatsCore {
        xp: row.get::<i64, _>("xp"),
        level: row.get::<i32, _>("level") as i64,
        streak_days: row.get::<i32, _>("streak_days") as i64,
        longest_streak: row.get::<i32, _>("longest_streak") as i64,
        freezes: row.get::<i32, _>("freezes") as i64,
        last_active_date: row.get::<Option<NaiveDate>, _>("last_active_date"),
        daily_goal: row.get::<i32, _>("daily_goal") as i64,
        daily_xp: row.get::<i32, _>("daily_xp") as i64,
        daily_date: row.get::<Option<NaiveDate>, _>("daily_date"),
        minute_bucket: row.get::<Option<DateTime<Utc>>, _>("minute_bucket"),
        minute_xp: row.get::<i32, _>("minute_xp") as i64,
    })
}

pub(crate) async fn load_counters<'c, E>(exec: E, user_id: Uuid, lock: bool) -> Result<CountersCore, sqlx::Error>
where
    E: sqlx::PgExecutor<'c>,
{
    let sql = if lock {
        "SELECT total_correct, total_sessions, perfect_sessions, good_pronunciations,
                sentences_built, daily_goal_streak,
                challenges_completed, challenge_streak, last_challenge_date
         FROM user_game_counters WHERE user_id = $1 FOR UPDATE"
    } else {
        "SELECT total_correct, total_sessions, perfect_sessions, good_pronunciations,
                sentences_built, daily_goal_streak,
                challenges_completed, challenge_streak, last_challenge_date
         FROM user_game_counters WHERE user_id = $1"
    };
    let row = sqlx::query(sql).bind(user_id).fetch_one(exec).await?;
    Ok(CountersCore {
        total_correct: row.get::<i32, _>("total_correct") as i64,
        total_sessions: row.get::<i32, _>("total_sessions") as i64,
        perfect_sessions: row.get::<i32, _>("perfect_sessions") as i64,
        good_pronunciations: row.get::<i32, _>("good_pronunciations") as i64,
        sentences_built: row.get::<i32, _>("sentences_built") as i64,
        daily_goal_streak: row.get::<i32, _>("daily_goal_streak") as i64,
        challenges_completed: row.get::<i32, _>("challenges_completed") as i64,
        challenge_streak: row.get::<i32, _>("challenge_streak") as i64,
        last_challenge_date: row.get::<Option<NaiveDate>, _>("last_challenge_date"),
    })
}

// ───────────────────────── HTTP-хендлеры ─────────────────────────

/// POST /api/game/event — единственная точка входа тренажёров в игровой слой.
pub async fn report_event(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(event): Json<StudyEvent>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    // Разговор дня засчитывает только handlers::challenge — после проверки,
    // что разговор сегодняшний и был настоящим. Иначе его можно было бы
    // присылать сюда сколько угодно раз по 25 XP.
    if matches!(event, StudyEvent::ChallengeComplete { .. }) {
        return Err(ApiError::response(
            StatusCode::BAD_REQUEST,
            "Разговор дня засчитывается через /api/challenge/complete",
        ));
    }
    ensure_rows(&pool, user_id).await.map_err(db_err)?;
    let mut tx = pool.begin().await.map_err(db_err)?;
    let update = award_event_in_tx(&mut tx, user_id, &event, Utc::now()).await.map_err(db_err)?;
    tx.commit().await.map_err(db_err)?;
    Ok(Json(update))
}

/// Правила + запись результата в рамках чужой транзакции. Вынесено из
/// report_event, чтобы разговор дня записывал факт выполнения и начисление
/// одним коммитом: не бывает «разговор засчитан, а XP нет» и наоборот.
/// Строки user_game_stats/counters должны уже существовать (ensure_rows).
pub(crate) async fn award_event_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    event: &StudyEvent,
    now: DateTime<Utc>,
) -> Result<GameUpdateDto, sqlx::Error> {
    let source = event.source().as_str();

    // FOR UPDATE держит строку до commit — второе одновременное событие того
    // же человека (двойной тап, два устройства) дождётся этой транзакции
    // вместо того, чтобы прочитать те же «старые» цифры и затереть начисление.
    let mut stats = load_stats(&mut **tx, user_id, true).await?;
    let mut counters = load_counters(&mut **tx, user_id, true).await?;
    let already_unlocked: HashSet<String> = sqlx::query(
        "SELECT achievement_id FROM user_achievements WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .map(|r| r.get::<String, _>("achievement_id"))
    .collect();

    let outcome = apply_event(&mut stats, &mut counters, &already_unlocked, event, now);

    sqlx::query(
        "UPDATE user_game_stats SET xp=$2, level=$3, streak_days=$4, longest_streak=$5, freezes=$6,
                last_active_date=$7, daily_goal=$8, daily_xp=$9, daily_date=$10,
                minute_bucket=$11, minute_xp=$12, updated_at=NOW()
         WHERE user_id=$1",
    )
    .bind(user_id)
    .bind(stats.xp)
    .bind(stats.level as i32)
    .bind(stats.streak_days as i32)
    .bind(stats.longest_streak as i32)
    .bind(stats.freezes as i32)
    .bind(stats.last_active_date)
    .bind(stats.daily_goal as i32)
    .bind(stats.daily_xp as i32)
    .bind(stats.daily_date)
    .bind(stats.minute_bucket)
    .bind(stats.minute_xp as i32)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE user_game_counters SET total_correct=$2, total_sessions=$3, perfect_sessions=$4,
                good_pronunciations=$5, sentences_built=$6, daily_goal_streak=$7,
                challenges_completed=$8, challenge_streak=$9, last_challenge_date=$10, updated_at=NOW()
         WHERE user_id=$1",
    )
    .bind(user_id)
    .bind(counters.total_correct as i32)
    .bind(counters.total_sessions as i32)
    .bind(counters.perfect_sessions as i32)
    .bind(counters.good_pronunciations as i32)
    .bind(counters.sentences_built as i32)
    .bind(counters.daily_goal_streak as i32)
    .bind(counters.challenges_completed as i32)
    .bind(counters.challenge_streak as i32)
    .bind(counters.last_challenge_date)
    .execute(&mut **tx)
    .await?;

    if outcome.xp_gained > 0 {
        sqlx::query("INSERT INTO user_game_xp_log (user_id, xp_delta, source) VALUES ($1, $2, $3)")
            .bind(user_id)
            .bind(outcome.xp_gained as i32)
            .bind(source)
            .execute(&mut **tx)
            .await?;
    }

    for a in &outcome.new_achievements {
        sqlx::query(
            "INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING",
        )
        .bind(user_id)
        .bind(a.id)
        .execute(&mut **tx)
        .await?;
    }

    Ok(GameUpdateDto {
        xp: stats.xp,
        xp_gained: outcome.xp_gained,
        level: stats.level,
        leveled_up: outcome.leveled_up,
        streak_days: stats.streak_days,
        daily_goal: stats.daily_goal,
        daily_progress: stats.daily_xp,
        new_achievements: outcome.new_achievements.iter().map(|a| AchievementDto::from(*a)).collect(),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementCatalogEntry {
    pub id: String,
    pub title: String,
    pub description: String,
    pub emoji: String,
    pub unlocked: bool,
    pub unlocked_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameStateResponse {
    pub xp: i64,
    pub level: i64,
    pub xp_into_level: i64,
    pub xp_for_next_level: i64,
    pub streak_days: i64,
    pub longest_streak: i64,
    pub freezes: i64,
    pub daily_goal: i64,
    pub daily_progress: i64,
    pub achievements: Vec<AchievementCatalogEntry>,
}

/// GET /api/game/me — текущее состояние + каталог достижений с флагом unlocked.
pub async fn get_me(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    ensure_rows(&pool, user_id).await.map_err(db_err)?;

    let stats = load_stats(&pool, user_id, false).await.map_err(db_err)?;
    let today = paris_date(Utc::now());
    // Дневной прогресс показываем «на сегодня» — если день уже сменился, а
    // событий ещё не было, daily_xp в БД хранит вчерашнее число до первого
    // сегодняшнего события (оно пересчитается apply_daily_goal при первом же).
    let daily_progress = if stats.daily_date == Some(today) { stats.daily_xp } else { 0 };
    let streak_days = visible_streak(stats.streak_days, stats.last_active_date, stats.freezes, today);

    let unlocked_rows = sqlx::query("SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .map_err(db_err)?;
    let unlocked_at: std::collections::HashMap<String, DateTime<Utc>> = unlocked_rows
        .into_iter()
        .map(|r| (r.get::<String, _>("achievement_id"), r.get::<DateTime<Utc>, _>("unlocked_at")))
        .collect();

    let (level, xp_into_level, xp_needed) = level_progress(stats.xp);

    let achievements = ACHIEVEMENTS
        .iter()
        .map(|a| AchievementCatalogEntry {
            id: a.id.to_string(),
            title: a.title.to_string(),
            description: a.description.to_string(),
            emoji: a.emoji.to_string(),
            unlocked: unlocked_at.contains_key(a.id),
            unlocked_at: unlocked_at.get(a.id).copied(),
        })
        .collect();

    Ok(Json(GameStateResponse {
        xp: stats.xp,
        level,
        xp_into_level,
        xp_for_next_level: xp_needed,
        streak_days,
        longest_streak: stats.longest_streak,
        freezes: stats.freezes,
        daily_goal: stats.daily_goal,
        daily_progress,
        achievements,
    }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FamilyGameMember {
    pub user_id: String,
    pub name: String,
    pub level: i64,
    pub xp: i64,
    pub streak_days: i64,
    pub xp_this_week: i64,
}

/// GET /api/game/family — семейное табло игрового слоя. Семья тут — весь
/// приватный инстанс, та же логика, что в handlers::family::get_board
/// (комментарий там же: инсталляция приватная, семья видит всех целиком).
pub async fn get_family(
    State(pool): State<PgPool>,
    AuthenticatedUser(_user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let rows = sqlx::query(
        "SELECT u.id,
                COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', COALESCE(p.last_name, ''))), ''),
                         split_part(u.email, '@', 1)) AS name,
                COALESCE(g.level, 1) AS level,
                COALESCE(g.xp, 0) AS xp,
                COALESCE(g.streak_days, 0) AS streak_days,
                g.last_active_date,
                COALESCE(g.freezes, 0) AS freezes,
                COALESCE((SELECT SUM(l.xp_delta) FROM user_game_xp_log l
                           WHERE l.user_id = u.id AND l.created_at >= NOW() - INTERVAL '7 days'), 0) AS xp_this_week
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN user_game_stats g ON g.user_id = u.id
         ORDER BY xp_this_week DESC, level DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let today = paris_date(Utc::now());
    let members: Vec<FamilyGameMember> = rows
        .iter()
        .map(|r| FamilyGameMember {
            user_id: r.get::<Uuid, _>("id").to_string(),
            name: r.get("name"),
            level: r.get::<i32, _>("level") as i64,
            xp: r.get::<i64, _>("xp"),
            streak_days: visible_streak(
                r.get::<i32, _>("streak_days") as i64,
                r.get::<Option<NaiveDate>, _>("last_active_date"),
                r.get::<i32, _>("freezes") as i64,
                today,
            ),
            xp_this_week: r.get::<i64, _>("xp_this_week"),
        })
        .collect();

    Ok(Json(members))
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

    // ---------- Europe/Paris: смещение, полночь, DST ----------

    #[test]
    fn winter_offset_is_one_hour() {
        // 15 января, глубокая зима — CET, +60 минут.
        assert_eq!(paris_offset_minutes(utc(2026, 1, 15, 12, 0)), 60);
    }

    #[test]
    fn summer_offset_is_two_hours() {
        // 15 июля — CEST, +120 минут.
        assert_eq!(paris_offset_minutes(utc(2026, 7, 15, 12, 0)), 120);
    }

    #[test]
    fn spring_forward_boundary() {
        // 2026: последнее воскресенье марта — 29 марта, переход в 01:00 UTC.
        let before = utc(2026, 3, 29, 0, 59);
        let after = utc(2026, 3, 29, 1, 0);
        assert_eq!(paris_offset_minutes(before), 60, "до 01:00 UTC ещё зима");
        assert_eq!(paris_offset_minutes(after), 120, "с 01:00 UTC уже лето");
    }

    #[test]
    fn fall_back_boundary() {
        // 2026: последнее воскресенье октября — 25 октября.
        let before = utc(2026, 10, 25, 0, 59);
        let after = utc(2026, 10, 25, 1, 0);
        assert_eq!(paris_offset_minutes(before), 120, "до 01:00 UTC ещё лето");
        assert_eq!(paris_offset_minutes(after), 60, "с 01:00 UTC уже зима");
    }

    #[test]
    fn midnight_paris_rolls_calendar_date_before_utc_midnight() {
        // Летом в 22:15 UTC в Париже уже 00:15 следующего дня — Paris date
        // должна отличаться от UTC-даты, хотя до полуночи UTC ещё почти 2 часа.
        let dt = utc(2026, 7, 10, 22, 15);
        assert_eq!(paris_date(dt), ymd(2026, 7, 11));
    }

    #[test]
    fn midnight_paris_winter_close_to_utc_midnight() {
        // Зимой сдвиг всего час: в 23:15 UTC в Париже уже следующий день.
        let dt = utc(2026, 1, 10, 23, 15);
        assert_eq!(paris_date(dt), ymd(2026, 1, 11));
        let before = utc(2026, 1, 10, 22, 45);
        assert_eq!(paris_date(before), ymd(2026, 1, 10));
    }

    // ---------- Уровни ----------

    #[test]
    fn level_starts_at_one_with_zero_xp() {
        assert_eq!(level_for_xp(0), 1);
    }

    #[test]
    fn level_curve_is_quick_early_slow_later() {
        let need_1 = xp_for_next_level(1);
        let need_20 = xp_for_next_level(20);
        assert!(need_1 < need_20, "порог должен расти с уровнем");
        // Явные числа, чтобы регресс формулы был заметен в диффе теста.
        assert_eq!(need_1, 115);
        assert_eq!(xp_for_next_level(2), 160);
    }

    #[test]
    fn level_progress_matches_level_for_xp() {
        for xp in [0, 50, 115, 300, 5000] {
            let (level, into, need) = level_progress(xp);
            assert_eq!(level, level_for_xp(xp));
            assert!(into < need, "накопленный XP внутри уровня меньше порога следующего");
        }
    }

    // ---------- XP по событиям ----------

    #[test]
    fn answer_first_try_beats_later_try() {
        let mut c = CountersCore::default();
        let first = compute_event_xp(&StudyEvent::Answer { source: StudySource::Flashcards, correct: true, first_try: true, combo: 0 }, &mut c);
        let later = compute_event_xp(&StudyEvent::Answer { source: StudySource::Flashcards, correct: true, first_try: false, combo: 0 }, &mut c);
        assert_eq!(first, 10);
        assert_eq!(later, 5);
    }

    #[test]
    fn wrong_answer_gives_nothing() {
        let mut c = CountersCore::default();
        let xp = compute_event_xp(&StudyEvent::Answer { source: StudySource::Course, correct: false, first_try: true, combo: 9 }, &mut c);
        assert_eq!(xp, 0);
        assert_eq!(c.total_correct, 0);
    }

    #[test]
    fn combo_bonus_is_capped_at_five() {
        let mut c = CountersCore::default();
        let xp = compute_event_xp(&StudyEvent::Answer { source: StudySource::Course, correct: true, first_try: true, combo: 999 }, &mut c);
        assert_eq!(xp, 15, "10 базовых + не больше 5 за комбо");
    }

    #[test]
    fn pronunciation_thresholds() {
        let mut c = CountersCore::default();
        assert_eq!(compute_event_xp(&StudyEvent::Pronunciation { source: StudySource::Course, score: 0.95 }, &mut c), 8);
        assert_eq!(c.good_pronunciations, 1);
        assert_eq!(compute_event_xp(&StudyEvent::Pronunciation { source: StudySource::Course, score: 0.6 }, &mut c), 3);
        assert_eq!(compute_event_xp(&StudyEvent::Pronunciation { source: StudySource::Course, score: 0.1 }, &mut c), 0);
        assert_eq!(c.good_pronunciations, 1, "только успешные считаются в счётчик");
    }

    #[test]
    fn session_complete_perfect_bonus() {
        let mut c = CountersCore::default();
        let normal = compute_event_xp(&StudyEvent::SessionComplete { source: StudySource::Course, cards: 10, correct: 7, minutes: 5.0 }, &mut c);
        let perfect = compute_event_xp(&StudyEvent::SessionComplete { source: StudySource::Course, cards: 10, correct: 10, minutes: 5.0 }, &mut c);
        assert_eq!(normal, 20);
        assert_eq!(perfect, 35);
        assert_eq!(c.perfect_sessions, 1);
        assert_eq!(c.total_sessions, 2);
    }

    #[test]
    fn per_event_cap_applies_even_to_engineered_input() {
        // На случай будущих правок формулы: одно событие не должно пробивать потолок.
        let mut c = CountersCore::default();
        let xp = compute_event_xp(&StudyEvent::SessionComplete { source: StudySource::Course, cards: 1000, correct: 1000, minutes: 1.0 }, &mut c).min(MAX_XP_PER_EVENT);
        assert!(xp <= MAX_XP_PER_EVENT);
    }

    // ---------- Лимит в минуту ----------

    #[test]
    fn minute_cap_throttles_rapid_events() {
        let mut stats = StatsCore::default();
        let t0 = utc(2026, 5, 1, 10, 0);
        let mut total = 0;
        for i in 0..20 {
            let t = t0 + ChronoDuration::seconds(i * 2); // 20 событий за 38 секунд
            total += apply_minute_cap(&mut stats, t, 15);
        }
        assert_eq!(total, MINUTE_XP_CAP, "суммарно не больше потолка в минуту");
    }

    #[test]
    fn minute_cap_resets_after_window() {
        let mut stats = StatsCore::default();
        let t0 = utc(2026, 5, 1, 10, 0);
        assert_eq!(apply_minute_cap(&mut stats, t0, 150), 150);
        assert_eq!(apply_minute_cap(&mut stats, t0 + ChronoDuration::seconds(10), 90), MINUTE_XP_CAP - 150, "упёрлись в потолок окна");
        let later = t0 + ChronoDuration::seconds(61);
        assert_eq!(apply_minute_cap(&mut stats, later, 50), 50, "новое окно — лимит снова полный");
    }

    // ---------- Серия и заморозки ----------

    #[test]
    fn streak_first_event_starts_at_one() {
        let mut stats = StatsCore::default();
        apply_streak(&mut stats, ymd(2026, 6, 1));
        assert_eq!(stats.streak_days, 1);
        assert_eq!(stats.longest_streak, 1);
    }

    #[test]
    fn streak_same_day_is_idempotent() {
        let mut stats = StatsCore::default();
        apply_streak(&mut stats, ymd(2026, 6, 1));
        apply_streak(&mut stats, ymd(2026, 6, 1));
        assert_eq!(stats.streak_days, 1);
    }

    #[test]
    fn streak_consecutive_day_increments() {
        let mut stats = StatsCore::default();
        apply_streak(&mut stats, ymd(2026, 6, 1));
        apply_streak(&mut stats, ymd(2026, 6, 2));
        assert_eq!(stats.streak_days, 2);
    }

    #[test]
    fn streak_missed_day_without_freeze_resets() {
        let mut stats = StatsCore::default();
        apply_streak(&mut stats, ymd(2026, 6, 1));
        apply_streak(&mut stats, ymd(2026, 6, 2));
        // Пропускаем 3 июня целиком, возвращаемся 4-го.
        apply_streak(&mut stats, ymd(2026, 6, 4));
        assert_eq!(stats.streak_days, 1, "без заморозки один пропуск рвёт серию");
        assert_eq!(stats.longest_streak, 2, "рекорд не уменьшается");
    }

    #[test]
    fn streak_missed_day_with_freeze_is_saved() {
        let mut stats = StatsCore { freezes: 1, ..Default::default() };
        apply_streak(&mut stats, ymd(2026, 6, 1));
        apply_streak(&mut stats, ymd(2026, 6, 2));
        // Пропуск 3 июня, но есть заморозка — серия продолжается как ни в чём не бывало.
        apply_streak(&mut stats, ymd(2026, 6, 4));
        assert_eq!(stats.streak_days, 3, "заморозка гасит один пропущенный день");
        assert_eq!(stats.freezes, 0, "и тратится");
    }

    #[test]
    fn streak_two_missed_days_breaks_even_with_freeze() {
        let mut stats = StatsCore { freezes: 2, ..Default::default() };
        apply_streak(&mut stats, ymd(2026, 6, 1));
        // Пропуск 2 и 3 июня — заморозка спасает только ОДИН день.
        apply_streak(&mut stats, ymd(2026, 6, 4));
        assert_eq!(stats.streak_days, 1);
        assert_eq!(stats.freezes, 2, "заморозка не тратится, если всё равно не спасает серию");
    }

    #[test]
    fn freeze_earned_every_seven_days_capped_at_two() {
        let mut stats = StatsCore::default();
        let mut day = ymd(2026, 1, 1);
        for _ in 0..21 {
            apply_streak(&mut stats, day);
            day += ChronoDuration::days(1);
        }
        assert_eq!(stats.streak_days, 21);
        assert_eq!(stats.freezes, 2, "заморозки капаются на 2 даже после трёх недель подряд");
    }

    #[test]
    fn comeback_flag_after_long_gap() {
        let mut stats = StatsCore::default();
        apply_streak(&mut stats, ymd(2026, 1, 1));
        let comeback = apply_streak(&mut stats, ymd(2026, 1, 20)); // 19 дней тишины
        assert!(comeback);
        assert_eq!(stats.streak_days, 1);
    }

    #[test]
    fn no_comeback_on_very_first_session() {
        let mut stats = StatsCore::default();
        let comeback = apply_streak(&mut stats, ymd(2026, 1, 1));
        assert!(!comeback, "камбэк не имеет смысла для самой первой сессии");
    }

    #[test]
    fn visible_streak_hides_a_streak_that_already_burned() {
        let today = ymd(2026, 6, 10);
        assert_eq!(visible_streak(5, Some(ymd(2026, 6, 10)), 0, today), 5, "занимались сегодня");
        assert_eq!(visible_streak(5, Some(ymd(2026, 6, 9)), 0, today), 5, "вчера — сегодня ещё можно продолжить");
        assert_eq!(visible_streak(5, Some(ymd(2026, 6, 8)), 1, today), 5, "один пропуск, заморозка спасёт");
        assert_eq!(visible_streak(5, Some(ymd(2026, 6, 8)), 0, today), 0, "один пропуск без заморозки — сгорела");
        assert_eq!(visible_streak(5, Some(ymd(2026, 6, 1)), 2, today), 0, "долгий перерыв");
        assert_eq!(visible_streak(0, None, 0, today), 0);
    }

    // ---------- Дневная цель ----------

    #[test]
    fn daily_goal_streak_breaks_when_goal_missed() {
        // Без крон-джобы «конец дня» узнаётся только следующим событием:
        // пока идёт день 2, его судьба ещё не решена, streak держит вчерашний
        // результат. Разрыв виден при переходе на день 3 — там мы наконец
        // оглядываемся на день 2 и видим, что цель не набралась.
        let mut stats = StatsCore { daily_goal: 50, ..Default::default() };
        let mut counters = CountersCore::default();
        apply_daily_goal(&mut stats, &mut counters, ymd(2026, 6, 1), 60); // цель выполнена
        assert_eq!(counters.daily_goal_streak, 1);
        apply_daily_goal(&mut stats, &mut counters, ymd(2026, 6, 2), 10); // не дотянули, но день ещё не закрыт
        assert_eq!(counters.daily_goal_streak, 1, "день 2 ещё не завершён — серия пока держится на дне 1");
        apply_daily_goal(&mut stats, &mut counters, ymd(2026, 6, 3), 0); // переход на день 3 — день 2 оценён задним числом
        assert_eq!(counters.daily_goal_streak, 0, "день 2 закрылся ниже цели — серия обнулилась");
    }

    #[test]
    fn daily_goal_streak_grows_on_consecutive_hits() {
        let mut stats = StatsCore { daily_goal: 50, ..Default::default() };
        let mut counters = CountersCore::default();
        for (i, day) in (1..=5).enumerate() {
            apply_daily_goal(&mut stats, &mut counters, ymd(2026, 6, day), 60);
            assert_eq!(counters.daily_goal_streak, (i + 1) as i64);
        }
    }

    #[test]
    fn daily_goal_gap_day_resets_streak() {
        let mut stats = StatsCore { daily_goal: 50, ..Default::default() };
        let mut counters = CountersCore::default();
        apply_daily_goal(&mut stats, &mut counters, ymd(2026, 6, 1), 60);
        // Дыра: 2 июня пропущено целиком, сразу 3 июня — не «подряд», счётчик
        // сбрасывается перед тем, как учесть сегодняшний (3 июня) результат.
        apply_daily_goal(&mut stats, &mut counters, ymd(2026, 6, 3), 60);
        assert_eq!(counters.daily_goal_streak, 1, "серия за 1 июня сгорела, но сегодняшняя цель тут же набрала новую");
    }

    // ---------- Достижения ----------

    #[test]
    fn first_session_unlocks_once() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        let outcome = apply_event(
            &mut stats,
            &mut counters,
            &already,
            &StudyEvent::SessionComplete { source: StudySource::Course, cards: 5, correct: 3, minutes: 4.0 },
            utc(2026, 6, 1, 10, 0),
        );
        assert!(outcome.new_achievements.iter().any(|a| a.id == "first_session"));
    }

    #[test]
    fn already_unlocked_is_not_repeated() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let mut already = HashSet::new();
        already.insert("first_session".to_string());
        let outcome = apply_event(
            &mut stats,
            &mut counters,
            &already,
            &StudyEvent::SessionComplete { source: StudySource::Course, cards: 5, correct: 3, minutes: 4.0 },
            utc(2026, 6, 1, 10, 0),
        );
        assert!(!outcome.new_achievements.iter().any(|a| a.id == "first_session"));
    }

    #[test]
    fn perfect_session_unlocks_achievement() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        let outcome = apply_event(
            &mut stats,
            &mut counters,
            &already,
            &StudyEvent::SessionComplete { source: StudySource::Course, cards: 5, correct: 5, minutes: 4.0 },
            utc(2026, 6, 1, 10, 0),
        );
        assert!(outcome.new_achievements.iter().any(|a| a.id == "perfect_session"));
    }

    #[test]
    fn early_bird_and_night_owl_depend_on_paris_local_hour() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        // 05:30 UTC зимой = 06:30 в Париже — до 7 утра, «жаворонок».
        let outcome = apply_event(
            &mut stats,
            &mut counters,
            &already,
            &StudyEvent::ExerciseComplete { source: StudySource::Course },
            utc(2026, 1, 10, 5, 30),
        );
        assert!(outcome.new_achievements.iter().any(|a| a.id == "early_bird"));

        let mut stats2 = StatsCore::default();
        let mut counters2 = CountersCore::default();
        // 22:30 UTC зимой = 23:30 в Париже — «сова».
        let outcome2 = apply_event(
            &mut stats2,
            &mut counters2,
            &already,
            &StudyEvent::ExerciseComplete { source: StudySource::Course },
            utc(2026, 1, 10, 22, 30),
        );
        assert!(outcome2.new_achievements.iter().any(|a| a.id == "night_owl"));
    }

    #[test]
    fn streak_achievements_unlock_at_thresholds() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        let mut day = ymd(2026, 1, 1);
        let mut unlocked_ids: HashSet<String> = HashSet::new();
        for _ in 0..3 {
            let outcome = apply_event(
                &mut stats,
                &mut counters,
                &already,
                &StudyEvent::ExerciseComplete { source: StudySource::Course },
                day.and_hms_opt(12, 0, 0).unwrap().and_utc(),
            );
            for a in outcome.new_achievements {
                unlocked_ids.insert(a.id.to_string());
            }
            day += ChronoDuration::days(1);
        }
        assert!(unlocked_ids.contains("streak_3"));
    }

    #[test]
    fn level_up_flag_set_only_when_level_actually_changes() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        // Первое очко опыта поднимает с уровня 1 (это и есть стартовый), leveled_up=false.
        let outcome = apply_event(
            &mut stats,
            &mut counters,
            &already,
            &StudyEvent::ExerciseComplete { source: StudySource::Course },
            utc(2026, 6, 1, 12, 0),
        );
        assert!(!outcome.leveled_up);
        assert_eq!(stats.level, 1);

        // Догоняем XP до порога следующего уровня (115) серией событий.
        let mut day = ymd(2026, 6, 2);
        let mut saw_level_up = false;
        for _ in 0..30 {
            let out = apply_event(
                &mut stats,
                &mut counters,
                &already,
                &StudyEvent::SessionComplete { source: StudySource::Course, cards: 10, correct: 10, minutes: 5.0 },
                day.and_hms_opt(12, 0, 0).unwrap().and_utc(),
            );
            if out.leveled_up {
                saw_level_up = true;
                break;
            }
            day += ChronoDuration::days(1);
        }
        assert!(saw_level_up, "после достаточного количества XP уровень обязан вырасти");
    }
    // ---------- Серия через apply_event: полночь по Парижу и смена часов ----------

    fn exercise() -> StudyEvent {
        StudyEvent::ExerciseComplete { source: StudySource::Course }
    }

    #[test]
    fn streak_counts_paris_days_across_midnight() {
        // 23:59 и 00:01 по Парижу (летом UTC+2) — два РАЗНЫХ дня, серия 2,
        // хотя по UTC оба события в одних сутках (21:59 и 22:01 10 июля).
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        apply_event(&mut stats, &mut counters, &already, &exercise(), utc(2026, 7, 10, 21, 59));
        apply_event(&mut stats, &mut counters, &already, &exercise(), utc(2026, 7, 10, 22, 1));
        assert_eq!(stats.streak_days, 2);
        assert_eq!(stats.last_active_date, Some(ymd(2026, 7, 11)));
    }

    #[test]
    fn streak_survives_spring_forward_night() {
        // 23:30 по Парижу 28 марта (CET, 22:30 UTC) и 23:30 29 марта (уже CEST,
        // 21:30 UTC): между ними всего 23 часа, но это соседние дни — серия 2.
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        apply_event(&mut stats, &mut counters, &already, &exercise(), utc(2026, 3, 28, 22, 30));
        apply_event(&mut stats, &mut counters, &already, &exercise(), utc(2026, 3, 29, 21, 30));
        assert_eq!(stats.streak_days, 2);
    }

    #[test]
    fn streak_survives_fall_back_night() {
        // 00:30 по Парижу 25 октября (ещё CEST, 22:30 UTC 24-го) и 23:30
        // 25 октября (уже CET, 22:30 UTC) — одни и те же парижские сутки,
        // хоть и 24 часа разницы: серия не растёт дважды.
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        apply_event(&mut stats, &mut counters, &already, &exercise(), utc(2026, 10, 24, 22, 30));
        apply_event(&mut stats, &mut counters, &already, &exercise(), utc(2026, 10, 25, 22, 30));
        assert_eq!(stats.streak_days, 1);
        assert_eq!(stats.last_active_date, Some(ymd(2026, 10, 25)));
    }

    #[test]
    fn clock_going_backwards_does_not_break_streak() {
        let mut stats = StatsCore { streak_days: 5, longest_streak: 5, last_active_date: Some(ymd(2026, 6, 10)), ..Default::default() };
        apply_streak(&mut stats, ymd(2026, 6, 9));
        assert_eq!(stats.streak_days, 5);
        assert_eq!(stats.last_active_date, Some(ymd(2026, 6, 10)));
    }

    #[test]
    fn freeze_grant_on_seventh_day_exactly() {
        let mut stats = StatsCore::default();
        let mut day = ymd(2026, 1, 1);
        for i in 1..=7 {
            apply_streak(&mut stats, day);
            assert_eq!(stats.freezes, if i < 7 { 0 } else { 1 }, "день {i}");
            day += ChronoDuration::days(1);
        }
    }

    #[test]
    fn deep_night_is_neither_early_bird_nor_night_owl() {
        // 01:00 по Парижу — не «сова» и не «жаворонок»: ночные занятия не поощряем.
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let out = apply_event(&mut stats, &mut counters, &HashSet::new(), &exercise(), utc(2026, 1, 10, 0, 0));
        assert!(!out.new_achievements.iter().any(|a| a.id == "early_bird" || a.id == "night_owl"));
    }

    #[test]
    fn achievements_still_reported_when_minute_cap_ate_the_xp() {
        // Лимит в минуту обнулил XP, но достижение за сессию должно прийти —
        // GameUpdate обязан нести newAchievements надёжно (на нём висит маскот).
        let t = utc(2026, 6, 1, 10, 0);
        let mut stats = StatsCore { minute_bucket: Some(t), minute_xp: MINUTE_XP_CAP, ..Default::default() };
        let mut counters = CountersCore::default();
        let out = apply_event(
            &mut stats,
            &mut counters,
            &HashSet::new(),
            &StudyEvent::SessionComplete { source: StudySource::Flashcards, cards: 3, correct: 3, minutes: 1.0 },
            t + ChronoDuration::seconds(5),
        );
        assert_eq!(out.xp_gained, 0);
        assert!(out.new_achievements.iter().any(|a| a.id == "first_session"));
        assert!(out.new_achievements.iter().any(|a| a.id == "perfect_session"));
    }

    #[test]
    fn catalog_ids_are_unique_and_all_reachable() {
        let mut ids = HashSet::new();
        for a in ACHIEVEMENTS {
            assert!(ids.insert(a.id), "дубликат id {}", a.id);
        }
        // Контекст «всё выполнено» открывает весь каталог — нет забытых id в qualifies().
        let all = AchievementContext {
            total_sessions: 1000, streak_days: 1000, total_correct: 1000, perfect_sessions: 1000,
            good_pronunciations: 1000, sentences_built: 1000, is_early_bird: true, is_night_owl: true,
            comeback: true, daily_goal_streak: 1000, level: 1000, xp: 1_000_000,
            challenges_completed: 1000, challenge_streak: 1000,
        };
        assert_eq!(newly_unlocked(&all, &HashSet::new()).len(), ACHIEVEMENTS.len());
        assert!(ACHIEVEMENTS.len() >= 15);
    }

    #[test]
    fn event_json_matches_frontend_contract() {
        // Форма из lib/game/client.ts: camelCase поля, type в snake_case.
        let e: StudyEvent = serde_json::from_str(
            r#"{"type":"answer","source":"flashcards","correct":true,"firstTry":true,"combo":3}"#,
        ).unwrap();
        assert!(matches!(e, StudyEvent::Answer { first_try: true, combo: 3, .. }));
        let e: StudyEvent = serde_json::from_str(
            r#"{"type":"session_complete","source":"verbs","cards":10,"correct":9,"minutes":4.5}"#,
        ).unwrap();
        assert!(matches!(e, StudyEvent::SessionComplete { cards: 10, correct: 9, .. }));
        let e: StudyEvent = serde_json::from_str(r#"{"type":"exercise_complete","source":"course"}"#).unwrap();
        assert!(matches!(e, StudyEvent::ExerciseComplete { source: StudySource::Course }));

        let dto = GameUpdateDto {
            xp: 1, xp_gained: 1, level: 1, leveled_up: false, streak_days: 1,
            daily_goal: 50, daily_progress: 1, new_achievements: vec![],
        };
        let v = serde_json::to_value(&dto).unwrap();
        for key in ["xp", "xpGained", "level", "leveledUp", "streakDays", "dailyGoal", "dailyProgress", "newAchievements"] {
            assert!(v.get(key).is_some(), "в GameUpdate нет поля {key}");
        }
    }

    // ---------- Разговор дня ----------

    fn challenge() -> StudyEvent {
        StudyEvent::ChallengeComplete { challenge_id: "w01".into(), turns: 5, minutes: 4.0 }
    }

    #[test]
    fn challenge_gives_25_xp_and_counts() {
        let mut c = CountersCore::default();
        assert_eq!(compute_event_xp(&challenge(), &mut c), 25);
        assert_eq!(c.challenges_completed, 1);
    }

    #[test]
    fn challenge_counts_for_streak_and_daily_goal() {
        let mut stats = StatsCore { daily_goal: 20, ..Default::default() };
        let mut counters = CountersCore::default();
        let out = apply_event(&mut stats, &mut counters, &HashSet::new(), &challenge(), utc(2026, 6, 1, 10, 0));
        assert_eq!(out.xp_gained, 25);
        assert_eq!(stats.streak_days, 1, "разговор держит общую серию");
        assert_eq!(stats.daily_xp, 25, "и идёт в дневную цель");
        assert_eq!(counters.daily_goal_streak, 1, "цель 20 перекрыта одним разговором");
        assert_eq!(counters.challenge_streak, 1);
        assert_eq!(counters.last_challenge_date, Some(ymd(2026, 6, 1)));
    }

    #[test]
    fn challenge_is_not_eaten_by_minute_cap() {
        let t = utc(2026, 6, 1, 10, 0);
        let mut stats = StatsCore { minute_bucket: Some(t), minute_xp: MINUTE_XP_CAP, ..Default::default() };
        let mut counters = CountersCore::default();
        let out = apply_event(&mut stats, &mut counters, &HashSet::new(), &challenge(), t + ChronoDuration::seconds(5));
        assert_eq!(out.xp_gained, 25);
        assert_eq!(stats.minute_xp, MINUTE_XP_CAP, "корзина минутного лимита не тронута");
    }

    #[test]
    fn talkative_unlocks_on_seventh_challenge_not_before() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let mut already = HashSet::new();
        // Семь разговоров через день — серия не набирается, а «Разговорчивый»
        // открывается ровно на седьмом.
        let mut day = ymd(2026, 6, 1);
        for i in 1..=7 {
            let out = apply_event(&mut stats, &mut counters, &already, &challenge(), day.and_hms_opt(10, 0, 0).unwrap().and_utc());
            let got = out.new_achievements.iter().any(|a| a.id == "talkative");
            assert_eq!(got, i == 7, "разговор {i}");
            for a in out.new_achievements { already.insert(a.id.to_string()); }
            day += ChronoDuration::days(2);
        }
        assert!(!already.contains("talk_week"), "через день — это не неделя подряд");
    }

    #[test]
    fn talk_week_needs_seven_days_in_a_row() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let mut already = HashSet::new();
        let mut day = ymd(2026, 6, 1);
        for i in 1..=7 {
            let out = apply_event(&mut stats, &mut counters, &already, &challenge(), day.and_hms_opt(10, 0, 0).unwrap().and_utc());
            let got = out.new_achievements.iter().any(|a| a.id == "talk_week");
            assert_eq!(got, i == 7, "день {i}");
            for a in out.new_achievements { already.insert(a.id.to_string()); }
            day += ChronoDuration::days(1);
        }
        assert_eq!(counters.challenge_streak, 7);
    }

    #[test]
    fn challenge_streak_breaks_on_a_missed_day_and_ignores_other_study() {
        let mut stats = StatsCore::default();
        let mut counters = CountersCore::default();
        let already = HashSet::new();
        apply_event(&mut stats, &mut counters, &already, &challenge(), utc(2026, 6, 1, 10, 0));
        apply_event(&mut stats, &mut counters, &already, &challenge(), utc(2026, 6, 2, 10, 0));
        // 3 июня только упражнения — общая серия растёт, серия разговоров нет.
        apply_event(&mut stats, &mut counters, &already, &exercise(), utc(2026, 6, 3, 10, 0));
        assert_eq!(counters.challenge_streak, 2);
        apply_event(&mut stats, &mut counters, &already, &challenge(), utc(2026, 6, 4, 10, 0));
        assert_eq!(counters.challenge_streak, 1, "пропуск разговора рвёт серию разговоров");
        assert_eq!(stats.streak_days, 4, "а общую серию держат и упражнения");
    }

    #[test]
    fn challenge_streak_uses_paris_days() {
        // 23:50 и 00:10 по Парижу (лето) — два дня подряд, хотя по UTC одни сутки.
        let mut counters = CountersCore::default();
        let mut stats = StatsCore::default();
        let already = HashSet::new();
        apply_event(&mut stats, &mut counters, &already, &challenge(), utc(2026, 7, 10, 21, 50));
        apply_event(&mut stats, &mut counters, &already, &challenge(), utc(2026, 7, 10, 22, 10));
        assert_eq!(counters.challenge_streak, 2);
    }

    #[test]
    fn visible_challenge_streak_hides_burned_streak() {
        let today = ymd(2026, 6, 10);
        assert_eq!(visible_challenge_streak(4, Some(ymd(2026, 6, 10)), today), 4);
        assert_eq!(visible_challenge_streak(4, Some(ymd(2026, 6, 9)), today), 4);
        assert_eq!(visible_challenge_streak(4, Some(ymd(2026, 6, 8)), today), 0);
        assert_eq!(visible_challenge_streak(0, None, today), 0);
    }

    #[test]
    fn challenge_event_json_shape() {
        let e: StudyEvent = serde_json::from_str(
            r#"{"type":"challenge_complete","challengeId":"w12","turns":6,"minutes":4.5}"#,
        ).unwrap();
        assert!(matches!(e, StudyEvent::ChallengeComplete { ref challenge_id, turns: 6, .. } if challenge_id == "w12"));
        assert_eq!(e.source().as_str(), "challenge");
    }
}
