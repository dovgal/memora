use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    println!("--- Schema Check ---");
    let tables: Vec<(String,)> = sqlx::query_as("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        .fetch_all(&pool)
        .await?;
        
    println!("Tables in DB:");
    for (name,) in &tables {
        println!("  - {name}");
    }
    
    let has_audio_table = tables.iter().any(|(n,)| n == "flashcard_audio");
    println!("\nflashcard_audio table exists: {has_audio_table}");
    
    if has_audio_table {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM flashcard_audio")
            .fetch_one(&pool)
            .await?;
        println!("Rows in flashcard_audio: {}", count.0);
        
        let sample: Vec<(uuid::Uuid, String, Vec<u8>)> = sqlx::query_as("SELECT flashcard_id, field_id, audio_data FROM flashcard_audio LIMIT 1")
            .fetch_all(&pool)
            .await?;
            
        if !sample.is_empty() {
            println!("Sample row: Card={}, Field={}, DataSize={}", sample[0].0, sample[0].1, sample[0].2.len());
        }
    }

    Ok(())
}
