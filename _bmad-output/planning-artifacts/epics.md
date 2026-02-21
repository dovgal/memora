stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - /Users/dovgal/Project/my-bmad-project/_bmad-output/planning-artifacts/prd.md
  - /Users/dovgal/Project/my-bmad-project/_bmad-output/planning-artifacts/architecture.md
---

# Memora - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Memora, decomposing the requirements from the PRD and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- **FR1:** Неавторизованные пользователи могут просматривать публичные наборы карточек.
- **FR2:** Пользователи могут авторизоваться (Email/Pass, Google SSO, Microsoft SSO).
- **FR3:** Система поддерживает роли: Ученик (Student) и Учитель (Teacher).
- **FR4:** Система проводит возрастной скрининг (дата рождения) согласно COPPA.
- **FR5:** Авторизованные пользователи могут создавать карточки вручную (с текстом и картинками).
- **FR6:** Пользователи могут генерировать карточки через текстовый промпт.
- **FR7:** Пользователи могут загружать фото конспектов (OCR) для автоматической генерации карточек.
- **FR8:** Пользователи должны подтвердить превью сгенерированных карточек (Preview & Revise) перед сохранением.
- **FR9:** Пользователи могут изучать карточки в режимах "Flashcards" (переворот), "Learn" (интервальное повторение/ввод), "Test" (генерация случайного экзамена).
- **FR10:** PWA кэширует открытые наборы для офлайн-доступа.
- **FR11:** Пользователи могут проходить Flashcards, Learn и Test без интернета с автоматической отложенной синхронизацией прогресса.
- **FR12:** Пользователи могут вести диалог с Q-Chat в рамках просматриваемого набора.
- **FR13:** Q-Chat объясняет ошибки пользователя, опираясь исключительно на семантику текущего сета.
- **FR14:** Учителя могут создавать виртуальные классы и запускать Live Mode.
- **FR15:** Ученики присоединяются к Live сессии по ссылке/QR-коду.
- **FR16:** Система случайно распределяет учеников по командам перед игрой.
- **FR17:** Ученики отправляют ответы в реальном времени с мобильных устройств.
- **FR18:** Ученики видят индивидуальный % изученности каждого сета.
- **FR19:** Учителя видят агрегированную статистику проблемных вопросов после каждой сессии Live Mode.

### NonFunctional Requirements

- **NFR-P1:** Задержка (latency) Live Mode < 100 мс (при стабильном 4G).
- **NFR-P2:** Время до первого ответа AI-генератора (фото/текст) < 15 сек (streaming).
- **NFR-P3:** Time to Interactive PWA-клиента < 2.0 сек онлайн, < 0.5 сек локально.
- **NFR-SEC1:** Отсутствие сбора PII для детей младше 13 лет без верифицированного согласия родителей (COPPA/GDPR-K).
- **NFR-SEC2:** Иерархический RBAC (Учитель имеет доступ к прогрессу только своих подтвержденных учеников - FERPA alignment).
- **NFR-SEC3:** AI Guardrails: Жесткая фильтрация промптов и ответов Q-Chat с SLA <0.1% ложных пропусков.
- **NFR-S1 (Classroom Burst):** Вебсокет-инфраструктура поддерживает одновременное подключение до 50 учеников за < 5 секунд без отказа.
- **NFR-A1 (WCAG):** Соответствие WCAG 2.1 AA (контрастность, 200% zoom).
- **NFR-A2 (Keyboard):** Инструменты Учителя полностью управляются с клавиатуры (Screen Reader support).

### Additional Requirements

- **Starter Template Initialization:** Architecture specifies a Custom Hybrid setup (`npx create-next-app` + `cargo new` workspace). This MUST be Epic 1 Story 1.
- **Type Generation:** Need to implement OpenAPI-to-TS or `typeshare` to synchronize Rust DTOs with Next.js TypeScript interfaces (High Priority Architecture Gap).
- **Authentication Bridge:** NextAuth.js on frontend must share its JWT signature secret securely with the Rust Axum backend middleware via Environment Variables.
- **JSON Serialization Pattern:** Rust backend MUST map all outputs to `camelCase` to comply with frontend consistency rules.
- **Database Migrations:** Schema must be managed via SQLx migrations.
- **WebSocket Protocol:** Live Mode requests require WebSocket over Redis Pub/Sub backend broker.
- **AI Streaming:** Q-Chat and Generation endpoints must use Server-Sent Events (SSE).

### FR Coverage Map

- **FR1:** Epic 1 - Просмотр публичных сетов без авторизации
- **FR2:** Epic 1 - Авторизация (SSO)
- **FR3:** Epic 1 - Роли (Student/Teacher)
- **FR4:** Epic 1 - COPPA возрастная проверка
- **FR5:** Epic 2 - Ручное создание карточек
- **FR6:** Epic 3 - AI генерация из текста
- **FR7:** Epic 3 - AI генерация из фото (OCR)
- **FR8:** Epic 3 - Подтверждение превью (Preview & Revise)
- **FR9:** Epic 2 - Режимы изучения (Flashcards, Learn, Test)
- **FR10:** Epic 2 - PWA кэширование
- **FR11:** Epic 2 - Офлайн прохождение и синхронизация
- **FR12:** Epic 4 - Диалог с Q-Chat
- **FR13:** Epic 4 - Контекстные объяснения ошибок
- **FR14:** Epic 5 - Создание классов и запуск Live Mode
- **FR15:** Epic 5 - Присоединение по QR-коду
- **FR16:** Epic 5 - Командное распределение
- **FR17:** Epic 5 - Ответы в реальном времени
- **FR18:** Epic 2 - Индивидуальный прогресс
- **FR19:** Epic 5 - Агрегированная статистика для учителя

## Epic List

### Epic 1: Project Foundation & User Identity
Создать фундамент платформы и обеспечить безопасный доступ пользователей с разделением ролей. *Пользователь может зарегистрироваться, войти в систему под своей ролью (Ученик/Учитель) и пройти легальную проверку возраста.*
**FRs covered:** FR1, FR2, FR3, FR4

#### Story 1.1: Project Initialization & Type Synchronization
As a Developer,
I want to initialize the Next.js 15 PWA and Rust Axum workspaces with automated cross-language type generation,
So that all future feature development relies on a strict, type-safe foundation.

**Acceptance Criteria:**
**Given** an empty project directory
**When** the initialization script is run
**Then** a `memora-web` (Next.js) and `memora-api` (Rust) workspace are created
**And** a tool (like OpenAPI-to-TS or Typeshare) is configured to generate TS interfaces from Rust DTOs automatically.

#### Story 1.2: Core Database Schema & Auth Backend
As a System Administrator,
I want the foundational database tables created and the Rust JWT middleware configured,
So that the backend can securely verify requests from the Next.js frontend.

**Acceptance Criteria:**
**Given** the running PostgreSQL database
**When** the SQLx migrations are executed
**Then** the `users` and `user_profiles` tables are created with strict snake_case naming
**And** the Rust backend can successfully decode and validate a JWT signed by NextAuth's secret.

#### Story 1.3: SSO Registration & COPPA Screening
As a New User,
I want to sign up using my Google or Microsoft account and verify my age,
So that I can access the platform legally without creating new passwords.

**Acceptance Criteria:**
**Given** a user on the registration page
**When** they click "Sign in with Google/Microsoft"
**Then** NextAuth handles the OAuth flow successfully
**And** if they are a new user, they are prompted for their Date of Birth
**And** if they are under 13, the system enforces the COPPA parental consent flow or restricts data collection (NFR-SEC1).

#### Story 1.4: Role Selection & Dashboard Routing
As an Authenticated User,
I want to select my role (Student or Teacher) and be routed appropriately,
So that I have access to the correct features (FR3).

**Acceptance Criteria:**
**Given** a newly registered user completing COPPA screening
**When** they select their account type (Student/Teacher)
**Then** their role is permanently saved to the database via the Rust API
**And** Teachers are routed to `/dashboard/teacher` while Students are routed to `/dashboard/student`
**And** role-based access control (RBAC) middleware prevents Students from accessing Teacher routes.

#### Story 1.5: Public Library Access
As an Unauthenticated User,
I want to be able to browse and view public flashcard sets,
So that I can evaluate the platform's value before registering (FR1).

**Acceptance Criteria:**
**Given** a user without an active session
**When** they navigate to a shared public set URL (e.g., `/set/123-public`)
**Then** the Next.js App Router renders the set content using Server Components
**And** the user is prompted to "Login to save progress" instead of seeing account errors.

### Epic 2: Manual Content Creation & Core Study Modes
Позволить пользователям создавать учебные наборы вручную и заучивать их локально (офлайн). *Пользователь может создать колоду карточек, а затем учить ее с помощью режимов Flashcards, Learn и Test даже без интернета.*
**FRs covered:** FR5, FR9, FR10, FR11, FR18

#### Story 2.1: Manual Flashcard Set Creation
As a Student or Teacher,
I want to manually create a new study set with text and image flashcards,
So that I can digitize my specific learning materials.

**Acceptance Criteria:**
**Given** an authenticated user on the dashboard
**When** they click "Create Set" and fill out the term/definition pairs
**Then** the set and its cards are saved to the PostgreSQL database
**And** any uploaded images are securely stored in the S3-compatible bucket
**And** the user is redirected to the created set's overview page.

#### Story 2.2: "Flashcards" Study Mode & Progress Tracking
As a Learner,
I want to flip through cards and mark them as known or unknown,
So that I can quickly review material and track my mastery.

**Acceptance Criteria:**
**Given** a user viewing a study set
**When** they enter "Flashcards" mode and swipe/click through the cards
**Then** their known/unknown status for each card is recorded (FR18)
**And** the UI displays their individual mastery percentage for the current set
**And** the progress is persisted to the backend upon completion.

#### Story 2.3: "Learn" & "Test" Evaluation Modes
As a Learner,
I want to study via spaced repetition (Learn) and take simulated exams (Test),
So that I can deeply memorize concepts and validate my readiness.

**Acceptance Criteria:**
**Given** a study set with at least 4 flashcards
**When** the user selects "Learn" mode
**Then** the system presents multiple-choice or typed-answer questions based on an SR (spaced repetition) algorithm
**When** the user selects "Test" mode
**Then** a fixed set of questions is generated, graded at the end, and the final score is recorded.

#### Story 2.4: PWA Offline Caching Strategy
As a Mobile User,
I want my recently viewed study sets to be available without an internet connection,
So that I can study during a commute or in areas with poor reception (FR10).

**Acceptance Criteria:**
**Given** the Next.js PWA is installed on a user's device
**When** they view a study set while online
**Then** the Service Worker caches the JSON payload and associated images via IndexedDB/Cache API
**And** the user can fully load and view the set when switching to offline mode.

#### Story 2.5: Offline Progress Synchronization
As an Offline Learner,
I want to complete study sessions without internet and have my progress saved,
So that my mastery data isn't lost when my connection drops (FR11).

**Acceptance Criteria:**
**Given** a user studying in offline mode
**When** they complete a "Flashcards", "Learn", or "Test" session
**Then** TanStack Query records the mutation in a local offline queue
**And** when the device regains network connectivity, the Service Worker automatically syncs all queued progress mutations to the Rust backend.

### Epic 3: AI-Powered Multi-Modal Creation
Кардинально ускорить создание контента с помощью искусственного интеллекта. *Пользователь может загрузить фото рукописного конспекта (OCR) или написать промпт, чтобы мгновенно сгенерировать набор карточек.*
**FRs covered:** FR6, FR7, FR8

#### Story 3.1: AI Gateway & SSE Streaming Infrastructure
As a Backend Developer,
I want to establish a secure, rate-limited AI Gateway using Server-Sent Events (SSE),
So that I can stream completions from OpenAI/Anthropic to the Next.js client without risking API key exposure or timeouts.

**Acceptance Criteria:**
**Given** an authenticated user requesting AI generation
**When** the Next.js client opens an SSE connection to the Rust backend
**Then** the backend proxies the request to the LLM provider
**And** the backend streams the JSON chunks back to the client as they arrive (NFR-P2)
**And** the backend enforces strict rate-limits (e.g., max 5 requests per minute per user).

#### Story 3.2: Text-Based Flashcard Generation
As a Student or Teacher,
I want to paste a block of text (like a lecture transcript) and have the AI extract key terms,
So that I don't have to manually pull out facts and definitions (FR6).

**Acceptance Criteria:**
**Given** a user on the "Generate with AI" screen
**When** they paste text and click "Generate"
**Then** the text is sent to the Rust AI Gateway with a strict JSON-schema system prompt
**And** the UI displays an animated skeleton-loading state while receiving the SSE stream
**And** the parsed term/definition pairs appear sequentially as they are generated.

#### Story 3.3: Photo OCR Content Extraction
As a Student,
I want to take a picture of my handwritten or printed notes and convert them to flashcards,
So that I can digitize physical materials in seconds (FR7).

**Acceptance Criteria:**
**Given** a user on a mobile device or desktop
**When** they upload or take a photo of notes
**Then** the image is uploaded to S3 and a pre-signed URL is sent to a multimodal LLM (e.g., GPT-4o) via the AI Gateway
**And** the AI extracts the text and structures it into flashcard pairs
**And** the results stream back to the UI in under 15 seconds (NFR-P2).

#### Story 3.4: "Preview & Revise" Generation Editor
As a Content Creator,
I want to review and edit the AI-generated flashcards before saving them permanently,
So that I can correct any AI hallucinations or OCR mistakes (FR8).

**Acceptance Criteria:**
**Given** the AI has finished streaming generated cards
**When** the user views the results
**Then** they are presented with an editable list of the term/definition pairs
**And** they can modify text, delete incorrect cards, or add missing ones manually
**And** only upon clicking "Save to Library" are the cards permanently committed to the PostgreSQL database.

### Epic 4: Q-Chat AI Tutor
Дать каждому ученику персонального репетитора, знающего контекст текущего материала. *Ученик может попросить AI объяснить сложный термин или ошибку, не выходя из контекста изучаемого набора.*
**FRs covered:** FR12, FR13

#### Story 4.1: Q-Chat Guardrails & Context Injection (Backend)
As a Backend Developer,
I want to build a middleware layer that injects the current flashcard set into the LLM prompt and enforces safety guardrails,
So that the AI acts strictly as an educational tutor and cannot be hijacked (NFR-SEC3).

**Acceptance Criteria:**
**Given** a chat message from the Next.js client
**When** the Rust backend receives the request
**Then** it fetches the referenced study set from PostgreSQL and appends it to the system prompt (Context Injection)
**And** it runs a lightweight validation (or uses a dedicated moderation model) to block NSFW or prompt injection attempts
**And** the safe, contextualized prompt is forwarded to the LLM via the SSE Gateway.

#### Story 4.2: Q-Chat Interface & Conversation History
As a Learner,
I want a chat interface next to my flashcards that remembers our conversation,
So that I can ask follow-up questions about the material seamlessly (FR12).

**Acceptance Criteria:**
**Given** a user studying a set
**When** they open the Q-Chat sidebar
**Then** they see a familiar chat interface (bubbles, typing indicators)
**And** their previous conversation history for this specific session is loaded from the backend
**And** they can type and receive streaming responses (SSE).

#### Story 4.3: Contextual Error Explanation
As a Learner,
I want Q-Chat to automatically explain why I got a question wrong during "Learn" mode,
So that I can understand my mistakes immediately without asking manually (FR13).

**Acceptance Criteria:**
**Given** a user in "Learn" mode
**When** they submit an incorrect answer
**Then** the UI shows a "Why is this wrong?" button
**When** the user clicks the button
**Then** Q-Chat automatically opens and generates an explanation comparing their wrong answer to the correct definition from the set.

### Epic 5: Live Mode (Synchronous Classroom)
Обеспечить соревновательный процесс в реальном времени для школьных классов. *Учитель запускает игру, ученики присоединяются по QR-коду, делятся на команды и соревнуются, а учитель получает аналитику пробелов в знаниях.*
**FRs covered:** FR14, FR15, FR16, FR17, FR19

#### Story 5.1: Live Mode WebSocket Server & Redis Broker
As a Backend Developer,
I want to build a scalable WebSocket server with Redis Pub/Sub integration,
So that multiple Rust container instances can consistently broadcast game state to a shared virtual classroom (NFR-S1).

**Acceptance Criteria:**
**Given** the required `live-ws` Rust workspace
**When** a client connects via WebSocket with a valid JWT
**Then** the connection is assigned to a specific "Live Room" ID
**And** any messages sent to that Room ID are published to Redis and broadcast to all connected clients in the room within 100ms (NFR-P1).

#### Story 5.2: Teacher Dashboard & Game Initialization
As a Teacher,
I want to select a flashcard set and launch a Live Game lobby,
So that I can display the Join Code and QR code on the classroom projector (FR14).

**Acceptance Criteria:**
**Given** a Teacher viewing their created study sets
**When** they click "Host Live Game"
**Then** a new Room is created on the Rust backend
**And** the UI transitions to a "Lobby" view displaying a large 6-digit Join Code and a scannable QR code
**And** the UI displays an updating counter of connected students.

#### Story 5.3: Student Join Flow & Team Sorting
As a Student,
I want to join a live game quickly using my smartphone and see my assigned team,
So that I can participate in the class activity without complex registration (FR15, FR16).

**Acceptance Criteria:**
**Given** a Student holding a smartphone
**When** they scan the Teacher's QR code or enter the 6-digit code
**Then** their device connects to the WebSocket room
**And** when the Teacher clicks "Start Game", the backend randomly distributes all connected students into teams (e.g., Tiger, Bear, Shark)
**And** the Student's screen updates to show their assigned team color and name.

#### Story 5.4: Synchronous Gameplay Execution
As a Classroom (Teacher + Students),
I want the game to progress through questions sequentially, with students answering on their devices and the leaderboard updating on the projector,
So that the learning process is engaging and competitive (FR17).

**Acceptance Criteria:**
**Given** an active Live Game
**When** the Teacher screen displays a term/question
**Then** the Students' screens display multiple-choice answers
**When** a Student selects the correct answer
**Then** the backend validates it and broadcasts a "Team Scored" event via Redis
**And** the Teacher's projector immediately updates the team race visualization (leaderboard).

#### Story 5.5: Post-Game Analytics
As a Teacher,
I want to see which questions the majority of the class got wrong immediately after the game ends,
So that I know what topics need to be reviewed right now (FR19).

**Acceptance Criteria:**
**Given** a Live Game that has just finished
**When** the Teacher clicks "End Game" or the final question is answered
**Then** the projector displays the winning team
**And** the UI provides a "Class Analytics" view showing the top 3 most missed terms
**And** the aggregate statistics are saved to the PostgreSQL database for future review.
