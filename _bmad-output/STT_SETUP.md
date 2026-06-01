# Включение серверной проверки произношения (whisper.cpp) на Railway

Серверный STT уже написан (`memora-api/src/handlers/pronunciation.rs`), но изолирован за
cargo-feature `stt`, чтобы текущий прод не менялся. Чтобы включить:

## 1. Локально проверить сборку
```bash
cd memora-api
cargo build --release --features stt
```
(нужны системные зависимости whisper-rs: clang/llvm; на Railway/Nixpacks обычно ставятся автоматически.)

## 2. Модель whisper
Скачать модель и положить в образ. Рекомендуется `base` (хорошо для французского, ~142 МБ):
```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```
Для экономии RAM на бесплатном тарифе можно `tiny` (~75 МБ).

## 3. Переменные окружения Railway (memora-api)
```
WHISPER_MODEL_PATH=/models/ggml-base.bin
```

## 4. railway.json (memora-api) — собирать с фичей
Заменить `startCommand`/build, чтобы фича включалась:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "nixpacksPlan": {
      "variables": { "SQLX_OFFLINE": "true" },
      "phases": {
        "setup": { "aptPkgs": ["clang", "libclang-dev", "cmake", "wget"] },
        "download-model": {
          "cmds": ["mkdir -p /models && wget -O /models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"]
        }
      }
    }
  },
  "deploy": { "startCommand": "cargo run --release --features stt", "numReplicas": 1 }
}
```

## 5. main.rs — добавить роут (под флагом)
```rust
// рядом с остальными audio-роутами
#[cfg(feature = "stt")]
let app = app.route("/api/audio/transcribe", axum::routing::post(handlers::pronunciation::transcribe));
```
(или добавить безусловно в цепочку `.route(...)`, если всегда собираете с `stt`.)

## 6. Фронт уже готов
`next.config.ts` проксирует `/api/audio/transcribe`, а страница курса
(`/dashboard/student/courses/french-a1`) сначала пытается серверный STT, а если эндпоинт
вернул не-200 — автоматически откатывается к браузерному Web Speech API. Никаких доработок фронта не требуется.

## Альтернатива без нативной сборки
Если сборка whisper-rs на Railway проблемна, разверните отдельный Python-сервис
`faster-whisper` (FastAPI) и поставьте `WHISPER_MODEL_PATH`/URL на него, а в `pronunciation.rs`
замените локальный вызов на HTTP-запрос (reqwest уже в зависимостях). Это проще в сборке,
но добавляет отдельный контейнер.
