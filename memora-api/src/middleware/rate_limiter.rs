use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    RateLimiter,
};
use std::sync::Arc;
use uuid::Uuid;
use dashmap::DashMap;

// 5 requests per minute
pub type AppRateLimiter = Arc<DashMap<Uuid, Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>>>;

pub fn initialize_rate_limiter() -> AppRateLimiter {
    Arc::new(DashMap::new())
}

// We will enforce the specific rate-limit check inside the `ai.rs` handler 
// rather than a global middleware because the AI route needs the cost tracking 
// specific to users, which we will verify right after decoding the JWT.
