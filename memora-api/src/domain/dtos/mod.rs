use serde::{Deserialize, Serialize};
use serde_json::Value;
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
    pub image_url: Option<String>,
    pub order_index: i32,
    pub fields_data: Value,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SetResponse {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub creator_id: String,
    pub fields_schema: Value,
    pub flashcards: Vec<FlashcardResponse>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SetSummaryResponse {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub fields_schema: Value,
    pub flashcard_count: i32,
    pub created_at: String,
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
    pub image_url: Option<String>,
    pub fields_data: Value,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateSetRequest {
    pub title: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub fields_schema: Value,
    pub flashcards: Vec<CreateFlashcardRequest>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FlashcardProgressRequest {
    pub flashcard_id: String,
    pub is_known: bool,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FSRSRatingRequest {
    pub flashcard_id: String,
    pub rating: u8, // 1=Again, 2=Hard, 3=Good, 4=Easy
    pub now: Option<String>, // Optional client-side timestamp
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReviewLogResponse {
    pub state: u8,
    pub due: String,
    pub scheduled_days: i32,
    pub elapsed_days: i32,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StudySessionRequest {
    pub set_id: String,
    pub progress_updates: Vec<FlashcardProgressRequest>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CardProgress {
    pub flashcard_id: String,
    pub state: u8, // 0=New, 1=Learning, 2=Review, 3=Relearning
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SetProgressResponse {
    pub total_cards: i32,
    pub known_cards: i32,
    pub mastery_percentage: i32,
    pub cards: Vec<CardProgress>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct QChatRequest {
    pub messages: Vec<ChatMessage>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AuthRequest {
    pub email: String,
    pub password: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAuthRequest {
    pub email: String,
    pub first_name: String,
    pub last_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderRequest {
    pub name: String,
    pub description: Option<String>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FolderResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub sets: Vec<SetSummaryResponse>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FolderSummaryResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub set_count: i32,
    pub created_at: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AddSetToFolderRequest {
    pub set_id: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFlashcardRequest {
    pub id: Option<String>,
    pub term: String,
    pub definition: String,
    pub image_url: Option<String>,
    pub fields_data: Value,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSetRequest {
    pub title: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub fields_schema: Value,
    pub flashcards: Vec<UpdateFlashcardRequest>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AIGenerateRequest {
    pub set_id: String,
    pub exercise_count: i32,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AIGradeRequest {
    pub set_id: String,
    pub card_id: String,
    pub question_type: String,
    pub user_answer: String,
    pub question_text: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AIGradeResponse {
    pub is_correct: bool,
    pub score: f32, // 0.0 to 1.0
    pub explanation: String,
    pub correct_answer: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AIAnalyzeRequest {
    pub content: String,
    pub user_objective: String, // translation, terms, summary, etc.
}
