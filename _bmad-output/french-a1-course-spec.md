# Курс «Французский A1» в Memora — техническая спецификация

## Что уже есть в проекте (переиспользуем, не пишем заново)
- **Ollama-грейдинг**: `POST /api/ai/learn/grade` → `AIGradeResponse { is_correct, score, explanation, correct_answer }` (`memora-api/src/handlers/ai.rs::grade_answer`). Объяснения уже на русском.
- **Генерация упражнений**: `POST /api/ai/learn/generate` (SSE) — 100 заданий по сету.
- **TTS (Inworld)**: `GET /api/audio/{flashcard_id}/{field}` — генерирует и кэширует mp3 в `flashcard_audio`. Голос fr → `Alain` (см. `audio.rs`).
- **FSRS-прогресс, наборы, кастомные поля** — таблицы `sets`, `flashcards` (JSONB `fields_schema`/`fields_data`).

## Что добавляем
1. **Страница курса A1** (`memora-web/src/app/(dashboard)/courses/french-a1/page.tsx`)
   - 100 заданий A1 с объяснениями (банк в `lib/courses/frenchA1.ts`).
   - 4 типа: множественный выбор, заполнение пропуска, перевод, грамматика/спряжение.
   - **Смена заданий**: перемешивание + «новый вариант» (подмена дистракторов / выбор другого поля).
   - **Интеллектуальная проверка**: для текстовых ответов — локальная нормализация + при сомнении вызов `/api/ai/learn/grade` (Ollama判) с объяснением.
   - **Озвучивание**: кнопка 🔊 у задания → существующий audio-эндпоинт или браузерный SpeechSynthesis (fr-FR) как fallback.
   - **Произношение**: запись голоса → проверка (браузерный Web Speech `fr-FR` сейчас; серверный STT — ниже).
   - **Итог**: процент, разбор ошибок, рекомендации по слабым темам (как в HTML-прототипе).

2. **STT-эндпоинт для произношения** (backend, аддитивно)
   - `POST /api/audio/transcribe` (multipart: `audio` + `expected` + `lang=fr`).
   - Движок: **whisper.cpp через крейт `whisper-rs`**, модель `ggml-base.bin` (бесплатно, ~150 МБ).
   - Возвращает `{ transcript, expected, similarity (0..1), is_correct, feedback }`.
   - Сравнение: нормализация + расстояние Левенштейна по словам.
   - Файл-заготовка: `memora-api/src/handlers/pronunciation.rs` (требует добавить в `Cargo.toml`:
     `whisper-rs = "0.12"`, `hound = "3"`, `axum` feature `multipart`; и скачать модель в образ Railway).

## Этапы (поэтапно, как просили)
- **Этап 1 (сделано в этом релизе)**: страница курса A1 + банк вопросов + ИИ-проверка + TTS + произношение через браузер + разбор/рекомендации.
- **Этап 2**: серверный STT (whisper.cpp) — файл-заготовка + инструкция по сборке на Railway.
- **Этап 3 (СДЕЛАНО)**: сид курса в БД миграцией `20260601000000_seed_french_a1_course.sql`.
  - Набор с фиксированным UUID `a1a1a1a1-0000-4a1a-8a1a-000000000001` (владелец — demo-teacher из initial-миграции).
  - 100 карт с детерминированными UUID (`a1a1a1a1-0000-4a1a-8a1a-<hex(id)>`), `term` = французская фраза (для TTS), `definition` = правильный ответ, `fields_data` хранит prompt/options/accept/explanation/category.
  - `fields_schema`: поле `term` с `ttsEnabled:true`, `language:"fr"`, `ttsVoice:"Alain"` → Inworld-TTS генерится по запросу `/api/audio/{cardUuid}/term_audio` и кэшируется в `flashcard_audio`.
  - Идемпотентно (ON CONFLICT DO UPDATE), применяется автоматически через `sqlx::migrate!()` при старте API.
  - Фронт курса теперь сначала пробует Inworld-аудио по детерминированному UUID карты, при неудаче — браузерный синтез.
  - Бонус: набор виден как обычный set по прямому UUID → доступны Flashcards/Learn/Match/Q-Chat и FSRS-повторения.

## Замечания по деплою
- Frontend-изменения деплоятся как есть (Next.js).
- STT увеличит размер Rust-образа (модель + libwhisper). На бесплатном тарифе Railway следить за RAM (~1 ГБ для base). Альтернатива без сборки нативщины — отдельный Python `faster-whisper` сервис.
- Браузерный Web Speech работает только в Chrome/Edge (не Firefox/Safari) — поэтому он как «быстрый старт», а whisper — как надёжный серверный путь.
