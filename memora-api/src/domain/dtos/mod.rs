use serde::{Deserialize, Serialize};
use typeshare::typeshare;

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: String,
    pub first_name: String,
    pub created_at: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingRequest {
    pub date_of_birth: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub role: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FlashcardResponse {
    pub id: String,
    pub term: String,
    pub definition: String,
    pub order_index: i32,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SetResponse {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub flashcards: Vec<FlashcardResponse>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RoleSelectionRequest {
    pub role: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateFlashcardRequest {
    pub term: String,
    pub definition: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateSetRequest {
    pub title: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub flashcards: Vec<CreateFlashcardRequest>,
}
