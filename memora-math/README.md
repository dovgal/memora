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
