use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    domain::dtos::{
        AddSetToFolderRequest, CreateFolderRequest, FolderResponse, FolderSummaryResponse,
        SetSummaryResponse,
    },
    middleware::auth::AuthenticatedUser,
};

pub async fn create_folder(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<CreateFolderRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    let folder = sqlx::query!(
        r#"
        INSERT INTO folders (user_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, created_at
        "#,
        user_id,
        payload.name,
        payload.description
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = FolderResponse {
        id: folder.id.to_string(),
        name: folder.name,
        description: folder.description,
        created_at: folder.created_at.map(|d| d.to_string()).unwrap_or_default(),
        sets: vec![], // New folder has no sets
    };

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_user_folders(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    let folders = sqlx::query!(
        r#"
        SELECT f.id, f.name, f.description, f.created_at, COUNT(fs.set_id) as set_count
        FROM folders f
        LEFT JOIN folder_sets fs ON f.id = fs.folder_id
        WHERE f.user_id = $1
        GROUP BY f.id
        ORDER BY f.created_at DESC
        "#,
        user_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response: Vec<FolderSummaryResponse> = folders
        .into_iter()
        .map(|record| FolderSummaryResponse {
            id: record.id.to_string(),
            name: record.name,
            description: record.description,
            set_count: record.set_count.unwrap_or(0) as i32,
            created_at: record.created_at.map(|d| d.to_string()).unwrap_or_default(),
        })
        .collect();

    Ok((StatusCode::OK, Json(response)))
}

pub async fn get_folder(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(folder_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let _user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    let parsed_folder_id = Uuid::parse_str(&folder_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid folder ID".to_string()))?;

    // First fetch folder details
    let folder = sqlx::query!(
        r#"
        SELECT id, name, description, created_at, user_id
        FROM folders
        WHERE id = $1
        "#,
        parsed_folder_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let folder = match folder {
        Some(f) => f,
        None => return Err((StatusCode::NOT_FOUND, "Folder not found".to_string())),
    };

    // Note: Here we might want to check if folder.user_id == _user_id for privacy,
    // assuming folders are private for now.
    if folder.user_id.to_string() != _user_id.to_string() {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    // Now fetch sets in this folder
    let sets = sqlx::query!(
        r#"
        SELECT s.id, s.title, s.description, s.created_at, s.fields_schema, COUNT(f.id) as flashcard_count
        FROM sets s
        JOIN folder_sets fs ON s.id = fs.set_id
        LEFT JOIN flashcards f ON s.id = f.set_id
        WHERE fs.folder_id = $1
        GROUP BY s.id, fs.added_at
        ORDER BY fs.added_at DESC
        "#,
        parsed_folder_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let sets_response: Vec<SetSummaryResponse> = sets
        .into_iter()
        .map(|record| SetSummaryResponse {
            id: record.id.to_string(),
            title: record.title,
            description: record.description,
            fields_schema: record.fields_schema,
            flashcard_count: record.flashcard_count.unwrap_or(0) as i32,
            created_at: record.created_at.to_string(), // Ensure datetime is a string here, depends on schema types
        })
        .collect();

    let response = FolderResponse {
        id: folder.id.to_string(),
        name: folder.name,
        description: folder.description,
        created_at: folder.created_at.map(|d| d.to_string()).unwrap_or_default(),
        sets: sets_response,
    };

    Ok((StatusCode::OK, Json(response)))
}

pub async fn add_set_to_folder(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(folder_id): Path<String>,
    Json(payload): Json<AddSetToFolderRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    let parsed_folder_id = Uuid::parse_str(&folder_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid folder ID".to_string()))?;

    let parsed_set_id = Uuid::parse_str(&payload.set_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid set ID".to_string()))?;

    // Verify folder belongs to user
    let folder = sqlx::query!(
        r#"
        SELECT user_id FROM folders WHERE id = $1
        "#,
        parsed_folder_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(f) = folder {
        if f.user_id != user_id {
            return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
        }
    } else {
        return Err((StatusCode::NOT_FOUND, "Folder not found".to_string()));
    }

    // Insert mapping
    // Handle potential duplicate key error if set is already in folder
    let _res = sqlx::query!(
        r#"
        INSERT INTO folder_sets (folder_id, set_id)
        VALUES ($1, $2)
        ON CONFLICT (folder_id, set_id) DO NOTHING
        "#,
        parsed_folder_id,
        parsed_set_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

pub async fn remove_set_from_folder(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((folder_id, set_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    let parsed_folder_id = Uuid::parse_str(&folder_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid folder ID".to_string()))?;

    let parsed_set_id = Uuid::parse_str(&set_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid set ID".to_string()))?;

    // Verify folder belongs to user
    let folder = sqlx::query!(
        r#"
        SELECT user_id FROM folders WHERE id = $1
        "#,
        parsed_folder_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(f) = folder {
        if f.user_id != user_id {
            return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
        }
    } else {
        return Err((StatusCode::NOT_FOUND, "Folder not found".to_string()));
    }

    // Delete mapping
    let _res = sqlx::query!(
        r#"
        DELETE FROM folder_sets
        WHERE folder_id = $1 AND set_id = $2
        "#,
        parsed_folder_id,
        parsed_set_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}
