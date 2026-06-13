# Memora × Projet Voltaire — технический план перевода курсов на метод Voltaire

> Цель: каждый **повтор** упражнения возвращает **то же правило в НОВОМ предложении**, сгенерированном LLM (Ollama Cloud), а не тот же заученный текст. Учащийся тренирует **навык применения правила**, а не память на конкретную фразу.
>
> Решения по объёму (согласованы): **план + старт реализации**; регенерация **на лету на каждый повтор**; пилот — курс **«Les verbes»**. Универсальный механизм делаем course-agnostic (как уже сделан `coach.rs`).

---

## 1. Что уже есть в Memora (аудит кода)

**Стек:** Rust/Axum + SQLx + Postgres (бэкенд `memora-api`); Next.js 15 PWA (`memora-web`); типы синхронизируются `typeshare` через `./sync.sh`.

**Ancrage Mémoriel® ≈ уже реализован:**
- FSRS 5.2 в `handlers/coach.rs`, таблица `course_exercise_reviews (user_id, course_id, unit_id, exercise_id, state, due, stability, difficulty, reps, lapses, last_review)`.
- Очередь коуча: сначала `due ≤ now`, потом новые. Оценка `record_coach_review` (1=Again…4=Easy), логи `course_review_logs`, streak/stats, `mark-known` (быстрая диагностика «я уже знаю»).

**LLM (Ollama Cloud, `gpt-oss:120b`) уже подключён** в `handlers/ai.rs`:
- `OllamaRequest/Message/Options`, хелперы `ollama_chat()` (нестриминговый), `extract_json_object()`, `extract_json_array()`.
- Эндпоинты: `generate_exercises`, `generate_a2_questions`, `generate_practice` (новые задания по слабым темам!), `explain_exercise` (ИИ-тьютор), `grade_answer`, `converse`, `generate_story`, `generate_course_unit`.
- Конфиг: `OLLAMA_API_KEY`, `OLLAMA_MODEL` (default `gpt-oss:120b`), `OLLAMA_BASE_URL` (default `…/api/chat`).

**Формат контента — `EditoUnit`** (`memora-web/src/lib/courses/edito-a1/index.ts`), он же в БД для пользовательских курсов (`custom_courses`/`custom_course_units`, JSONB):
```ts
EditoUnit { title, description, vocabulary?[], exercises: EditoExercise[] }
EditoExercise {
  id, type: 'theory'|'grammar-quiz'|'sentence-builder'|'gender-quiz'
            |'dialogue'|'fill-blank'|'number-quiz'|'listening'|'video',
  title, content?, questions?, text?, blanks?, sentences?, exchanges?, ...
}
GrammarQuestion { question, options[], correctAnswer, explanation? }
BlankItem { correctAnswer, options?[], explanation? }
```
> NB: формат A2 (`frenchA2.ts`) уже имеет поле `grammarPoint` — фактически «ключ правила». В `EditoUnit` явного ключа правила нет: его вводим (раздел 3).

**Курсы:** встроенные (`edito-a1`, `edito-a2`, `mettre`, `niveau`) — в бандле фронтенда; пользовательские — в БД. «Les verbes» — пользовательский курс в БД (собран конструктором; материалы-исходники в `/Les verbes/`). Механизм делаем независимым от того, где лежит курс — по `course_id` (строка или UUID), как `coach.rs`.

---

## 2. Главный разрыв

`course_exercise_reviews.exercise_id` указывает на **статичное** упражнение в JSON юнита. Повтор по FSRS показывает **тот же текст** → тренируется память на фразу, а не навык. Нужно отделить **правило (что тренируем)** от **варианта (конкретное предложение)**.

---

## 3. Модель «правило → варианты»

**Правило (rule)** — стабильная единица обучения и планирования FSRS. Ключ правила = существующий `exercise_id` (на него уже завязаны ревью — менять не нужно). Семантику правила задаёт «эталонное» (seed) упражнение из юнита + метаданные.

**Метаданные правила** (новое, опционально в `EditoExercise`):
```ts
rule?: {
  id: string;          // стабильный ключ (по умолчанию = exercise.id)
  skill: string;       // напр. 'verb-government', 'transitivity', 'homophone', 'agreement'
  point: string;       // человекочитаемое правило, напр. "se rappeler — переходный, БЕЗ 'de'"
  examplesCorrect?: string[];
  trap?: string;       // типичная ошибка/ловушка, напр. "se rappeler de qch"
  cefr?: string;       // 'A2','B1'…
}
variantPolicy?: {
  regenerateOnRepeat?: boolean;   // default true для коуча
  format?: 'preserve' | 'error-hunt' | 'grammar-quiz' | 'fill-blank';
  avoidLastN?: number;            // сколько последних вариантов избегать (default 5)
}
```
Если `rule` не задан — деривируем «на лету» из самого упражнения (title/тип/varианты ответов) тем же промптом; явные метаданные просто повышают качество. Так механизм работает на **любом** существующем курсе без переразметки, а «Les verbes» размечаем эталонно.

**Вариант (variant)** — сгенерированный экземпляр того же типа и правила с другим текстом. Не участвует в FSRS-планировании (планируется правило), но логируется (анти-повтор, фолбэк, модерация).

---

## 4. Новый тип упражнения: `error-hunt` (какография)

Канонический формат Voltaire. Добавляем в `EditoExercise.type` и создаём React-компонент.

```ts
// error-hunt
sentence: string;            // "Il se rappelle de son enfance."
tokens?: string[];           // опц. разбиение для клика (иначе сплит по словам на клиенте)
errorIndex: number | null;   // индекс ошибочного токена; null = ошибки нет
correction?: string;         // "se rappelle"
explanation: string;         // правило по-русски
```
UI: клик по слову или кнопка «Нет ошибки» → мгновенная подсветка + правило. Идеален для «Les verbes» (переходность/управление: `se rappeler qch` без `de`, `se souvenir de qch`, `téléphoner à qqn`…).

---

## 5. Регенерация на лету (основной поток)

### 5.1. Эндпоинт
`POST /api/ai/course/regenerate-variant` (новый, в `handlers/ai.rs`).

**Вход** (`RegenerateVariantRequest`):
```jsonc
{
  "courseId": "…", "unitId": "…", "exerciseId": "…",   // = ключ правила
  "seedExercise": { /* EditoExercise эталона */ },
  "format": "error-hunt" | "preserve" | null,
  "avoidSentences": ["…", "…"],   // последние варианты (анти-повтор)
  "language": "французский", "level": "A2"
}
```

**Логика:**
1. Rate-limit (как везде: `check_rate_limit`).
2. Собрать промпт (раздел 6) из seed + `rule` (если есть) + `avoidSentences`.
3. `ollama_chat(messages, ~700)` → `extract_json_object` → распарсить в строго типизированный вариант.
4. **Валидация** (раздел 7). При провале — до 2 ретраев, затем **фолбэк**: вернуть случайный непоказанный вариант из лога/исходный seed (флаг `fallback: true`).
5. Залогировать вариант в `course_exercise_variants`.
6. Вернуть `{ variant: EditoExercise, ruleId, fallback }`.

### 5.2. Когда вызывать
- **Первый показ правила** (`reps == 0` в `course_exercise_reviews`) → показываем **seed** (куратор-эталон: первое знакомство с правилом на выверенном примере).
- **Любой повтор** (`reps > 0`) → дергаем `regenerate-variant`, показываем свежий вариант. FSRS-ревью пишем по-прежнему на `exerciseId` (правило) — планирование не ломается.
- Анти-повтор: клиент передаёт `avoidSentences` = последние N показанных вариантов (берём из ответа эндпоинта/локального кэша).

### 5.3. Safety net (не противоречит «на лету»)
Таблица `course_exercise_variants` — **не пул-предзагрузка**, а: (а) память анти-повтора, (б) фолбэк при недоступности Ollama/невалидном JSON, (в) журнал для модерации/жалоб «плохой вопрос». Опциональный фоновый прогрев (1–2 варианта на правило) — отдельным шагом, если решим резать задержку.

---

## 6. Промпт (черновик, RU-инструкция, FR-контент)

System:
```
Ты — методист по французскому (метод Projet Voltaire). Сгенерируй ОДНО новое упражнение
типа «найди ошибку» (cacographie), проверяющее ТО ЖЕ правило, что и эталон, но на ДРУГОМ
предложении и другой лексике.
Правило: {rule.point || выведи из эталона}.
Типичная ловушка: {rule.trap || —}.
Уровень: {level}. Французский — безупречный и естественный.
В предложении должна быть РОВНО ОДНА целевая ошибка (или НИ ОДНОЙ — иногда корректное
предложение, чтобы тренировать и вариант «нет ошибки»).
Не повторяй эти предложения: {avoidSentences}.
Верни ТОЛЬКО валидный JSON без markdown:
{"sentence": str, "errorIndex": int|null, "correction": str|null, "explanation": str (по-русски, кратко: правило + почему)}.
errorIndex — индекс слова с ошибкой при разбиении sentence по пробелам, 0-based; null если ошибки нет.
```
User: `Эталон (JSON): {seedExercise}. Сгенерируй вариант сейчас.`

Для `format: preserve` — генерим в типе seed (`grammar-quiz`/`fill-blank`) тем же шаблоном, что `generate_practice`.

---

## 7. Валидация и качество (критично)
LLM-контент проверяем **на бэкенде** перед отдачей:
- JSON-схема (serde) — типы и обязательные поля.
- `errorIndex` в диапазоне `0..len(split_whitespace)` или `null`.
- Если `errorIndex != null` → `correction` непуст и отличается от ошибочного токена.
- `explanation` непуст, длина в разумных пределах; язык объяснения — русский.
- Анти-повтор: `sentence` не входит в `avoidSentences` (нормализация регистра/пробелов).
- (Доп., по желанию) быстрый само-чек вторым коротким запросом «верна ли ровно одна ошибка?» — дорого, по флагу.
При провале → ретрай → фолбэк (раздел 5.1). Кнопка «пожаловаться на вопрос» → пометка `flagged` в логе.

---

## 8. Миграция БД
Файл `memora-api/migrations/20260613000000_voltaire_variants.sql`:
```sql
CREATE TABLE IF NOT EXISTS course_exercise_variants (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL,
    course_id    TEXT NOT NULL,
    unit_id      TEXT NOT NULL,
    exercise_id  TEXT NOT NULL,          -- = ключ правила
    rule_key     TEXT,                    -- опц. явный skill/rule
    format       TEXT NOT NULL DEFAULT 'error-hunt',
    payload      JSONB NOT NULL,          -- сгенерированный EditoExercise-вариант
    sentence     TEXT,                    -- для анти-повтора/поиска
    source       TEXT NOT NULL DEFAULT 'ollama', -- 'ollama' | 'fallback' | 'seed'
    flagged      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_variants_lookup
    ON course_exercise_variants (user_id, course_id, unit_id, exercise_id, created_at DESC);
```
Ревью-таблицу **не трогаем** — планирование по правилу уже корректно.

---

## 9. Интеграция в коуч (фронтенд, пилот «Les verbes»)
- Клиентский хелпер `regenerateVariant()` (fetch к новому эндпоинту) — добавить в `memora-web/src/lib/courses/…` (рядом с `customCoursesApi.ts`).
- В компоненте сессии коуча (`courses/[courseId]/coach/page.tsx`): при выборе следующего элемента очереди — если `review.reps > 0` и `variantPolicy.regenerateOnRepeat !== false`, запросить вариант, показать его; иначе показать seed. Хранить `avoidSentences` в локальном состоянии сессии.
- Рендер `error-hunt` — новый компонент (клик по слову / «нет ошибки»), переиспользует стиль grammar-quiz.
- Запись ревью — без изменений (по `exerciseId`).

## 10. Разметка «Les verbes» (эталон)
Проставить `rule` каждому упражнению (skill: `verb-government`/`transitivity`, point, trap, examplesCorrect) и `variantPolicy.format='error-hunt'`. На основе исходников `/Les verbes/les_verbes_et_leurs_prepositions.pdf` и видео «Transitif ou intransitif». Это даёт лучший контроль качества генерации; прочие курсы работают и без разметки (деривация на лету).

---

## 11. Раскатка
1. **Пилот:** «Les verbes» — разметка правил + `error-hunt` + регенерация на повторе.
2. **A2:** уже есть `grammarPoint` и `generate_a2_questions` — переключить повторы на регенерацию (минимум работы).
3. **Édito A1 / mettre / niveau:** деривация правила на лету (без переразметки), позже — точечная разметка.
4. **Пользовательские курсы:** конструктор может вызывать ту же генерацию; в `generate_course_unit` добавить заполнение `rule`.

## 12. Риски и решения
| Риск | Решение |
|---|---|
| Задержка Ollama на повторе | Спиннер «новый пример…»; опц. фоновый прогрев 1–2 вариантов; фолбэк-кэш |
| Невалидный/кривой французский | Серверная валидация + ретрай + фолбэк; кнопка «пожаловаться»; логи |
| Стоимость токенов | `gpt-oss:120b` на бесплатном тарифе Ollama Cloud; короткий вывод (~700 токенов); кэш-лог как фолбэк |
| Сбой планирования FSRS | Не трогаем `course_exercise_reviews`; планируем правило, варьируем только текст |
| Семантический дрейф (правило «уплыло») | Жёсткий промпт с `rule.point`/`trap` + примеры; разметка эталонов |

## 13. Чек-лист реализации (этой сессии)
- [x] Миграция `course_exercise_variants`.
- [x] Эндпоинт `regenerate_variant` + DTO + промпт + валидация + фолбэк (в `ai.rs`).
- [x] Роут в `main.rs`.
- [x] Клиентский хелпер + тип `error-hunt` (фронтенд) — каркас.
- [ ] React-компонент `error-hunt` и врезка в сессию коуча — следующий шаг.
- [ ] Разметка `rule` для «Les verbes».
- [ ] `./sync.sh` (typeshare) после стабилизации DTO.
