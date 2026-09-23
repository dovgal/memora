// Кабинет администратора: полный сброс карточек семьи перед новым стартом.
//
// Обычной кнопки «удалить всё» в интерфейсе нет нигде специально — это делает
// только владелец инсталляции из отдельной страницы, печатая фразу
// подтверждения целиком. Сервер лишь проверяет право и фразу; сам клик всегда
// делает человек.

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use uuid::Uuid;

use crate::middleware::auth::{AuthenticatedUser, Claims};
use super::errors::ApiError;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

/// Кто администратор.
///
/// Список опознавателей задаётся в настройках сервера (ADMIN_USER_IDS), а не
/// ролью в базе: роль едет в пропуске и обновляется только при следующем входе,
/// а через Google вход может не повторяться неделями. Здесь же право
/// проверяется при каждом запросе.
///
/// Назначить себя администратором из приложения нельзя ни при каком раскладе:
/// список читается только из окружения. Общая точка для всех хендлеров —
/// раньше своя копия жила в books.rs, здесь она одна на всех.
pub fn is_admin(sub: &str) -> bool {
    match std::env::var("ADMIN_USER_IDS") {
        Ok(raw) => admin_list_contains(&raw, sub),
        Err(_) => false,
    }
}

/// Разбор списка — отдельно от окружения, чтобы его можно было испытать.
fn admin_list_contains(raw: &str, sub: &str) -> bool {
    let sub = sub.trim();
    if sub.is_empty() {
        return false;
    }
    raw.split([',', ';', ' ', '\n'])
        .map(str::trim)
        .any(|id| !id.is_empty() && id.eq_ignore_ascii_case(sub))
}

fn require_admin(user: &Claims) -> ApiResult<()> {
    if is_admin(&user.sub) {
        Ok(())
    } else {
        Err(ApiError::response(StatusCode::FORBIDDEN, "Доступно только администратору"))
    }
}

/// Фраза подтверждения — печатается целиком, без исправлений сервером.
/// Сверяем побайтово: подгонка регистра или пробелов превратила бы
/// подтверждение в формальность.
const CONFIRM_PHRASE: &str = "УДАЛИТЬ ВСЕ КАРТОЧКИ";

fn confirm_phrase_matches(s: &str) -> bool {
    s == CONFIRM_PHRASE
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminMeResponse {
    pub is_admin: bool,
}

/// GET /api/admin/me — виден ли этому человеку кабинет администратора.
pub async fn me(AuthenticatedUser(user): AuthenticatedUser) -> impl IntoResponse {
    Json(AdminMeResponse { is_admin: is_admin(&user.sub) })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerSummary {
    pub user_id: String,
    pub name: String,
    pub sets_count: i64,
    pub cards_count: i64,
    pub set_titles: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetsSummaryResponse {
    pub owners: Vec<OwnerSummary>,
    pub total_sets: i64,
    pub total_cards: i64,
}

/// GET /api/admin/sets/summary — сколько наборов и карточек у каждого члена
/// семьи, чтобы владелец видел, что именно потеряется перед удалением.
pub async fn sets_summary(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    require_admin(&user)?;

    // Имя — тем же способом, что на семейном табло (family::get_board):
    // из профиля, а если его нет — хэндл до «@» вместо полного адреса.
    let rows = sqlx::query(
        "SELECT u.id AS user_id,
                COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', COALESCE(p.last_name, ''))), ''),
                         split_part(u.email, '@', 1)) AS name,
                s.id AS set_id,
                s.title AS set_title,
                COALESCE(c.card_count, 0) AS card_count
         FROM sets s
         JOIN users u ON u.id = s.creator_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN (SELECT set_id, COUNT(*) AS card_count FROM flashcards GROUP BY set_id) c
                ON c.set_id = s.id
         ORDER BY u.id, s.created_at"
    )
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let mut owners: Vec<OwnerSummary> = Vec::new();
    let mut index_by_user: HashMap<Uuid, usize> = HashMap::new();
    let mut total_sets: i64 = 0;
    let mut total_cards: i64 = 0;

    for r in rows {
        let user_id: Uuid = r.get("user_id");
        let name: String = r.get("name");
        let set_title: String = r.get("set_title");
        let card_count: i64 = r.get("card_count");

        total_sets += 1;
        total_cards += card_count;

        let idx = *index_by_user.entry(user_id).or_insert_with(|| {
            owners.push(OwnerSummary {
                user_id: user_id.to_string(),
                name,
                sets_count: 0,
                cards_count: 0,
                set_titles: Vec::new(),
            });
            owners.len() - 1
        });
        owners[idx].sets_count += 1;
        owners[idx].cards_count += card_count;
        owners[idx].set_titles.push(set_title);
    }

    owners.sort_by(|a, b| a.name.cmp(&b.name));

    Ok((StatusCode::OK, Json(SetsSummaryResponse { owners, total_sets, total_cards })))
}

#[derive(Deserialize)]
pub struct DeleteAllSetsRequest {
    pub confirm: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAllSetsResponse {
    pub sets_deleted: i64,
    pub cards_deleted: i64,
}

/// DELETE /api/admin/sets — стирает ВСЕ наборы и карточки всех членов семьи.
///
/// Одна транзакция: либо стирается всё, либо ничего. Карточки удаляем
/// отдельным запросом ДО наборов — не потому что без этого пропадут связанные
/// записи (flashcards → sets каскадно, и flashcard_audio/fsrs_records/
/// review_logs/flashcard_progress каскадно от flashcards), а чтобы честно
/// посчитать cardsDeleted: у самого DELETE FROM sets того же числа не было бы.
/// books.set_id и user_book_state.set_id проставлены ON DELETE SET NULL —
/// они просто опустеют, книга не пострадает и своё слово в неё можно будет
/// добавить снова (см. handlers::books::add_card — набор создаётся заново,
/// если set_id пуст).
pub async fn delete_all_sets(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<DeleteAllSetsRequest>,
) -> ApiResult<impl IntoResponse> {
    require_admin(&user)?;

    if !confirm_phrase_matches(&payload.confirm) {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Неверная фраза подтверждения"));
    }

    let mut tx = pool.begin().await.map_err(db_err)?;

    let cards_deleted = sqlx::query("DELETE FROM flashcards")
        .execute(&mut *tx)
        .await
        .map_err(db_err)?
        .rows_affected() as i64;

    let sets_deleted = sqlx::query("DELETE FROM sets")
        .execute(&mut *tx)
        .await
        .map_err(db_err)?
        .rows_affected() as i64;

    tx.commit().await.map_err(db_err)?;

    Ok((StatusCode::OK, Json(DeleteAllSetsResponse { sets_deleted, cards_deleted })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_list_is_read_forgivingly() {
        let list = "61600d9b-ac3d-45dc-a91d-d91d8f201aad, 11111111-1111-1111-1111-111111111111";
        assert!(admin_list_contains(list, "61600d9b-ac3d-45dc-a91d-d91d8f201aad"));
        assert!(admin_list_contains(list, "11111111-1111-1111-1111-111111111111"));
        // Регистр в опознавателе значения не имеет.
        assert!(admin_list_contains(list, "61600D9B-AC3D-45DC-A91D-D91D8F201AAD"));
    }

    #[test]
    fn everyone_else_is_not_admin() {
        let list = "61600d9b-ac3d-45dc-a91d-d91d8f201aad";
        assert!(!admin_list_contains(list, "22222222-2222-2222-2222-222222222222"));
        // Пустой список — администраторов нет вовсе.
        assert!(!admin_list_contains("", "61600d9b-ac3d-45dc-a91d-d91d8f201aad"));
        // Пустой опознаватель не должен совпасть с пустым местом в списке.
        assert!(!admin_list_contains("a, , b", ""));
    }

    #[test]
    fn exact_phrase_matches() {
        assert!(confirm_phrase_matches("УДАЛИТЬ ВСЕ КАРТОЧКИ"));
    }

    #[test]
    fn anything_else_is_rejected() {
        assert!(!confirm_phrase_matches("удалить все карточки"));
        assert!(!confirm_phrase_matches("УДАЛИТЬ ВСЕ КАРТОЧКИ "));
        assert!(!confirm_phrase_matches(" УДАЛИТЬ ВСЕ КАРТОЧКИ"));
        assert!(!confirm_phrase_matches(""));
        assert!(!confirm_phrase_matches("yes"));
    }
}
