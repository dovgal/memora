use axum::Json;
use crate::middleware::auth::AuthenticatedUser;
use crate::domain::dtos::UserProfile;

// Dummy protected endpoint to verify middleware works
// Returns the decoded user as a UserProfile (which uses camelCase serialization)
pub async fn me_handler(user: AuthenticatedUser) -> Json<UserProfile> {
    let profile = UserProfile {
        id: user.0.sub,
        first_name: "MockUser".to_string(), // In reality we'd fetch this from the DB
        created_at: "2026-02-21T00:00:00Z".to_string(),
    };
    
    Json(profile)
}
