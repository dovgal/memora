// Серверная проверка произношения через whisper.cpp (whisper-rs).
//
// ВКЛЮЧЕНИЕ (этап 2, по готовности):
// 1. В Cargo.toml добавить:
//      whisper-rs = "0.12"
//      hound = "3.5"
//      symphonia = { version = "0.5", features = ["mp3", "aac", "isomp4", "ogg"] }   # для декодирования webm/ogg от браузера
//    и включить feature `multipart` у axum (он уже есть в axum 0.8 как "multipart").
// 2. В Dockerfile/Nixpacks образа Railway скачать модель:
//      ADD https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin /models/ggml-base.bin
//    (base ≈ 142 МБ, хорошо распознаёт французский; для экономии RAM можно tiny ≈ 75 МБ).
//    Указать путь через переменную окружения WHISPER_MODEL_PATH=/models/ggml-base.bin
// 3. В handlers/mod.rs: `pub mod pronunciation;` (раскомментировать).
// 4. В main.rs добавить роут:
//      .route("/api/audio/transcribe", post(handlers::pronunciation::transcribe))
//    и в next.config.ts rewrites добавить проксирование /api/audio/transcribe.
//
// Пока файл собран ПОД ФЛАГОМ `stt`, чтобы не ломать прод-сборку, где модель/зависимости отсутствуют.
// Сборка с STT:  cargo build --release --features stt
#![cfg(feature = "stt")]

use axum::{
    extract::Multipart,
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::env;

use super::errors::ApiError;

#[derive(Serialize)]
pub struct TranscribeResponse {
    pub transcript: String,
    pub expected: String,
    pub similarity: f32, // 0.0..1.0
    pub is_correct: bool,
    pub feedback: String,
}

/// POST /api/audio/transcribe  (multipart/form-data)
///   audio:    файл записи (webm/ogg/wav)
///   expected: эталонная фраза на французском
///   lang:     код языка (по умолчанию "fr")
pub async fn transcribe(
    mut multipart: Multipart,
) -> Result<Json<TranscribeResponse>, (StatusCode, Json<ApiError>)> {
    let mut audio_bytes: Vec<u8> = Vec::new();
    let mut expected = String::new();
    let mut lang = "fr".to_string();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::response(StatusCode::BAD_REQUEST, format!("Multipart error: {e}")))?
    {
        match field.name().unwrap_or("") {
            "audio" => {
                audio_bytes = field
                    .bytes()
                    .await
                    .map_err(|e| ApiError::response(StatusCode::BAD_REQUEST, format!("Audio read error: {e}")))?
                    .to_vec();
            }
            "expected" => {
                expected = field.text().await.unwrap_or_default();
            }
            "lang" => {
                lang = field.text().await.unwrap_or_else(|_| "fr".to_string());
            }
            _ => {}
        }
    }

    if audio_bytes.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "No audio provided"));
    }

    // 1. Декодируем входной звук в 16kHz mono f32 (whisper требует именно это).
    let samples = decode_to_pcm_16k_mono(&audio_bytes)
        .map_err(|e| ApiError::response(StatusCode::UNPROCESSABLE_ENTITY, format!("Audio decode error: {e}")))?;

    // 2. Запускаем whisper.
    let model_path = env::var("WHISPER_MODEL_PATH").unwrap_or_else(|_| "/models/ggml-base.bin".to_string());
    let transcript = run_whisper(&model_path, &samples, &lang)
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Whisper error: {e}")))?;

    // 3. Сравниваем с эталоном.
    let sim = similarity(&normalize(&transcript), &normalize(&expected));
    let is_correct = sim >= 0.7;
    let feedback = if is_correct {
        format!("Отлично! Произношение распознано как «{transcript}».")
    } else {
        format!("Услышано «{transcript}». Эталон: «{expected}». Попробуйте ещё раз, чётче проговаривая слова.")
    };

    Ok(Json(TranscribeResponse {
        transcript,
        expected,
        similarity: sim,
        is_correct,
        feedback,
    }))
}

fn run_whisper(model_path: &str, samples: &[f32], lang: &str) -> Result<String, String> {
    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    let ctx = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
        .map_err(|e| format!("load model: {e:?}"))?;
    let mut state = ctx.create_state().map_err(|e| format!("state: {e:?}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some(lang));
    params.set_translate(false);
    params.set_print_progress(false);
    params.set_print_special(false);
    params.set_print_realtime(false);

    state.full(params, samples).map_err(|e| format!("full: {e:?}"))?;

    let num = state.full_n_segments().map_err(|e| format!("segments: {e:?}"))?;
    let mut text = String::new();
    for i in 0..num {
        if let Ok(seg) = state.full_get_segment_text(i) {
            text.push_str(&seg);
        }
    }
    Ok(text.trim().to_string())
}

/// Декодирование произвольного аудио в 16kHz mono f32 через symphonia.
fn decode_to_pcm_16k_mono(input: &[u8]) -> Result<Vec<f32>, String> {
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;
    use std::io::Cursor;

    let mss = MediaSourceStream::new(Box::new(Cursor::new(input.to_vec())), Default::default());
    let probed = symphonia::default::get_probe()
        .format(&Hint::new(), mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("probe: {e}"))?;
    let mut format = probed.format;
    let track = format.default_track().ok_or("no default track")?;
    let track_id = track.id;
    let src_rate = track.codec_params.sample_rate.unwrap_or(48000);
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("decoder: {e}"))?;

    let mut mono: Vec<f32> = Vec::new();
    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }
        if let Ok(decoded) = decoder.decode(&packet) {
            let spec = *decoded.spec();
            let mut buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
            buf.copy_interleaved_ref(decoded);
            let ch = spec.channels.count().max(1);
            for frame in buf.samples().chunks(ch) {
                let avg = frame.iter().copied().sum::<f32>() / ch as f32;
                mono.push(avg);
            }
        }
    }

    // Простейшая ресемплинг-децимация к 16kHz.
    let target = 16000u32;
    if src_rate == target {
        return Ok(mono);
    }
    let ratio = src_rate as f32 / target as f32;
    let out_len = (mono.len() as f32 / ratio) as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        out.push(mono[(i as f32 * ratio) as usize]);
    }
    Ok(out)
}

fn normalize(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| !matches!(c, '.' | ',' | '!' | '?' | ';' | ':'))
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn similarity(a: &str, b: &str) -> f32 {
    if a == b {
        return 1.0;
    }
    let dist = levenshtein(a, b) as f32;
    let max = a.chars().count().max(b.chars().count()).max(1) as f32;
    (1.0 - dist / max).max(0.0)
}

fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut dp: Vec<usize> = (0..=b.len()).collect();
    for (i, ca) in a.iter().enumerate() {
        let mut prev = dp[0];
        dp[0] = i + 1;
        for (j, cb) in b.iter().enumerate() {
            let tmp = dp[j + 1];
            dp[j + 1] = if ca == cb { prev } else { 1 + prev.min(dp[j + 1]).min(dp[j]) };
            prev = tmp;
        }
    }
    dp[b.len()]
}
