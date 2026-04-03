use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("--- Field ID Stats ---");
    let rows: Vec<(String, i64)> = sqlx::query_as("SELECT field_id, COUNT(*) FROM flashcard_audio GROUP BY field_id")
        .fetch_all(&pool)
        .await?;

    for (field_id, count) in rows {
        println!("{}: {}", field_id, count);
    }

    Ok(())
}
