pub mod ai;
pub mod auth;
pub mod live;
pub mod protected;
pub mod sets;
pub mod study;
pub mod users;
pub mod folders;
pub mod errors;
pub mod audio;
pub mod classes;

// Серверная проверка произношения (whisper.cpp). Компилируется только с --features stt.
#[cfg(feature = "stt")]
pub mod pronunciation;

