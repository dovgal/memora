# memora-math

CAS-микросервис (SymPy/FastAPI) для Memora: эквивалентность выражений
(`2(x+1)` ≡ `2x+2`) и верификация арифметики LLM-сгенерированных задач.

## Деплой на Railway

1. New Service → из этого репозитория, Root Directory = `memora-math`.
2. Variables: `MATH_SERVICE_TOKEN` — случайный секрет (`openssl rand -hex 24`).
3. У сервиса memora-api добавить:
   - `MATH_SERVICE_URL` — внутренний URL сервиса (например `http://memora-math.railway.internal:8080`)
   - `MATH_SERVICE_TOKEN` — тот же секрет.

Без этих переменных memora-api работает как раньше: проверка symbolic отвечает 503,
варианты numeric-задач не генерируются (упражнения повторяются дословно).

**Сеть.** Сервис общается с memora-api ТОЛЬКО по приватной сети Railway
(IPv6, `*.railway.internal`), поэтому `uvicorn --host ::` обязателен и публичный
домен не нужен. Разворачивать в том же регионе, что memora-api (`us-east`).
Примечание: публичный service-домен на Railway отдаёт 502 при биндинге `--host ::`
(edge ожидает IPv4) — это ожидаемо и не влияет на приватный путь; публичный домен
математике не выдаём.

Проверка живого деплоя (приватный путь, через API):
```
POST https://<api>/api/check/symbolic  {"expected":"2*x + 2","given":"2(x+1)"}  -> {"correct":true}
```

## Локально

```bash
cd memora-math
pip install -r requirements.txt
MATH_SERVICE_TOKEN=dev uvicorn main:app --port 8090  # локально
curl -s -X POST localhost:8090/check-equivalence \
  -H 'Authorization: Bearer dev' -H 'Content-Type: application/json' \
  -d '{"expected": "2*x + 2", "given": "2(x+1)"}'
# {"equivalent": true}
```
