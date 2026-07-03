use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .connect(&database_url)
        .await?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM flashcards WHERE fields_data::text LIKE '%__AUDIO_ON_SERVER__%'").fetch_one(&pool).await?;
    println!("Marker count: {}", count.0);

    let sample: Vec<(uuid::Uuid, String)> = sqlx::query_as("SELECT id, fields_data::text FROM flashcards WHERE fields_data::text LIKE '%__AUDIO_ON_SERVER__%' LIMIT 5").fetch_all(&pool).await?;
    for (id, data) in sample {
        println!("{id}: {data}");
    }
    Ok(())
}
