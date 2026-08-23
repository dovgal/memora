"""Распознавание речи для тренажёров произношения (faster-whisper, CPU).

Зачем отдельный сервис: браузерный Web Speech API не даёт выбрать микрофон —
распознавание всегда идёт с устройства по умолчанию, и при подключённых
Bluetooth-наушниках голос приходит в узкой полосе, а оценки выходят ниже
реальных. Здесь распознаётся запись, которую страница сделала сама, с того
микрофона, который выбрали мы.

В Rust-образ это не встроено намеренно: whisper-rs раздувал его больше гигабайта
и ломал сборку на Railway (см. примечание в memora-api/Cargo.toml).
"""

import io
import os
import tempfile

from fastapi import FastAPI, HTTPException, Request

from faster_whisper import WhisperModel
from pypdf import PdfReader

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE", "int8")
SHARED_TOKEN = os.getenv("WHISPER_TOKEN", "")
MAX_BYTES = int(os.getenv("WHISPER_MAX_BYTES", str(12 * 1024 * 1024)))
# Книги в PDF заметно тяжелее записей голоса.
MAX_PDF_BYTES = int(os.getenv("MAX_PDF_BYTES", str(48 * 1024 * 1024)))

# Модель поднимается один раз на старте: загрузка занимает секунды, и делать
# это на каждом запросе значило бы добавлять их к каждой попытке ученика.
model = WhisperModel(MODEL_NAME, device="cpu", compute_type=COMPUTE_TYPE)

app = FastAPI(title="Memora speech-to-text")


def _check_token(request: Request) -> None:
    if not SHARED_TOKEN:
        return
    header = request.headers.get("authorization", "")
    if header.removeprefix("Bearer ").strip() != SHARED_TOKEN:
        raise HTTPException(status_code=401, detail="bad token")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": MODEL_NAME, "compute": COMPUTE_TYPE}


@app.post("/pdf-text")
async def pdf_text(request: Request) -> dict:
    """Текстовый слой PDF постранично.

    В браузере это делает pdf.js, но на iOS шестая версия падает внутри себя —
    в разборе одного и того же файла на компьютере всё проходит, а на телефоне
    нет. Здесь разбор не зависит от браузера вовсе.
    """
    _check_token(request)

    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="empty body")
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="pdf too large")

    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
    except Exception as exc:  # noqa: BLE001 — причину показываем читателю как есть
        raise HTTPException(status_code=422, detail=f"pdf parse failed: {exc}") from exc

    return {"pages": pages, "pageCount": len(pages)}


@app.post("/transcribe")
async def transcribe(request: Request) -> dict:
    """Тело запроса — сам аудиофайл (webm/opus от MediaRecorder), язык в query."""
    _check_token(request)

    audio = await request.body()
    if not audio:
        raise HTTPException(status_code=400, detail="empty body")
    if len(audio) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="audio too large")

    language = (request.query_params.get("language") or "fr")[:5]

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as tmp:
        tmp.write(audio)
        tmp.flush()
        # Ключевые параметры именно для проверки произношения:
        #  • эталонная фраза модели НЕ передаётся — иначе она перескажет
        #    ожидаемое вместо того, что человек произнёс на самом деле;
        #  • temperature=0 и condition_on_previous_text=False убирают
        #    «додумывание» связного текста;
        #  • vad_filter выключен: он вырезает короткие реплики, а здесь
        #    сплошь отдельные слова и двухсловные фразы.
        segments, info = model.transcribe(
            tmp.name,
            language=language,
            beam_size=5,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=False,
            word_timestamps=True,
        )

        words: list[dict] = []
        parts: list[str] = []
        for segment in segments:
            parts.append(segment.text)
            for word in segment.words or []:
                words.append({
                    "word": word.word.strip(),
                    "start": round(word.start, 2),
                    "end": round(word.end, 2),
                    # Уверенность модели в слове: низкая обычно означает, что
                    # произнесено невнятно. Пригодится для разбора ошибок.
                    "probability": round(word.probability, 3),
                })

    return {
        "text": " ".join(p.strip() for p in parts).strip(),
        "language": info.language,
        "words": words,
    }
