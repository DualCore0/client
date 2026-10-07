# ClassRank — AI Build Instructions & Development Roadmap

> **How to use this file:** Give this whole file to an AI coding assistant. Then say: *"Read this file. Start with Phase 0. Do only the phase I name, then stop and wait."* Never ask it to build everything at once.

---

## 0. Instructions for the AI (read first)

You are a senior full-stack engineer. Build the project below **one phase at a time**.

Rules:
1. Do only the phase the user names. Stop when it is done.
2. Before coding, state the files you will create or change.
3. Do **not** change the database schema unless the user approves.
4. Never hardcode secrets. Use `.env`. Provide `.env.example`.
5. Validate all request bodies (DTOs + class-validator).
6. After each phase give: how to run it, how to test it, what "done" looks like.
7. Keep code simple. No extra features outside the MVP.
8. Server is the source of truth. Never trust scores or answers sent from the browser.
9. Never send correct answers to students before they submit.
10. Teacher must review AI-generated questions before publishing. AI must never auto-publish.

---

## 1. Project Summary

**ClassRank** is a web app where:
- Teachers create **Rooms**, upload a PDF, generate an MCQ test with AI (RAG), review it, and publish it.
- Students join a Room by **code, QR, or link**, take timed tests, and get a server-graded score.
- Each Room has a **Room Leaderboard**. The platform has a **Global Weekly Leaderboard**.

**Problem solved:** Teachers waste time turning PDFs into tests. Results are scattered. Students get late feedback and no sense of progress.

**Flows**
- Teacher: `Sign up → Create Room → Upload PDF → Generate Test → Review → Publish → Share Room`
- Student: `Sign up → Join Room → Open Test → Attempt → Submit → Score → Leaderboard`
- Platform: `Attempts → Aggregation → Weekly Global Ranking`

---

## 2. Tech Stack

| Layer | Tech | Purpose |
|---|---|---|
| Frontend | Next.js + TypeScript | UI, routing, test screen, leaderboards |
| Backend | NestJS + TypeScript | Auth, rooms, tests, AI orchestration, grading, rankings |
| ORM | Prisma | DB access |
| Database | Neon PostgreSQL | Source of truth |
| Cache | Redis (e.g. Upstash) | Leaderboards, rate limits |
| Vector DB | Qdrant | PDF chunk embeddings, semantic retrieval |
| AI | LLM API | Generate MCQs as JSON |

**Env vars (`.env.example`)**
```
DATABASE_URL=
REDIS_URL=
QDRANT_URL=
QDRANT_API_KEY=
AI_API_KEY=
JWT_SECRET=
FRONTEND_URL=
```

**Optional simplification:** If short on time, skip Qdrant and send extracted PDF text directly to the LLM. Keep the same API shape so Qdrant can be added later.

---

## 3. MVP Scope

**In scope**
- Auth with roles (TEACHER, STUDENT)
- Rooms: create, code, QR, share link, join
- Manual test creation, then AI test creation from PDF (MCQ only)
- Timed attempts, server-side grading, result page
- Room leaderboard, global weekly leaderboard
- Teacher and student dashboards

**Out of scope (do NOT build)**
Chat, friends, messaging, video, payments, heavy proctoring, mobile app, recommendations, badges, multiple AI agents.

---

## 4. Data Model (Prisma / PostgreSQL)

```
users:         id, name, email(unique), passwordHash, role, createdAt
rooms:         id, roomCode(unique), name, subject, description, createdBy, createdAt
room_members:  id, roomId, userId, joinedAt   (unique roomId+userId)
documents:     id, roomId, fileName, fileUrl, status, uploadedBy, createdAt
tests:         id, roomId, documentId?, title, duration, questionCount, difficulty,
               status(DRAFT|PUBLISHED|CLOSED), createdBy, createdAt, publishedAt
questions:     id, testId, questionText, options(json, 4 items), correctAnswer(0-3),
               difficulty, createdAt
attempts:      id, testId, userId, score, percentage, correctAnswers, wrongAnswers,
               timeTaken, startedAt, submittedAt   (unique testId+userId unless retakes allowed)
answers:       id, attemptId, questionId, selectedAnswer, isCorrect
```

Room code rules: random, 6 chars, unique, human-readable (avoid 0/O, 1/I). Never expose sequential DB ids publicly.

---

## 5. API Endpoints

```
Auth
POST /auth/register
POST /auth/login
GET  /auth/me

Rooms
POST /rooms                      (teacher)
GET  /rooms                      (my rooms)
GET  /rooms/:roomCode
POST /rooms/:roomCode/join       (student)

Documents
POST /documents/upload           (teacher)
GET  /documents/:id

AI
POST /ai/generate-test           (teacher, rate-limited)

Tests
POST /tests
GET  /tests/:id
PATCH /tests/:id/questions/:qid  (edit)
DELETE /tests/:id/questions/:qid
POST /tests/:id/publish

Attempts
POST /tests/:id/start
POST /attempts/:id/submit
GET  /attempts/:id/result

Leaderboard
GET /rooms/:roomCode/leaderboard
GET /leaderboard/global/weekly
```

NestJS modules: `auth, users, rooms, room-members, documents, ai, tests, questions, attempts, leaderboard, prisma, common`.

---

## 6. Core Logic

**Question JSON (LLM must return only this, no prose):**
```json
{
  "questions": [
    {
      "question": "Which normal form removes partial dependency?",
      "options": ["1NF", "2NF", "3NF", "BCNF"],
      "correctAnswer": 1,
      "difficulty": "MEDIUM"
    }
  ]
}
```
Backend must validate: exactly 4 options, `correctAnswer` in 0–3, non-empty text, no duplicate options. Retry once or twice on invalid output.

**Attempt rules:** verify student is in Room, test is PUBLISHED, no duplicate submit, enforce timer server-side (reject late submit or auto-close), grade on server.

**Room leaderboard:** average percentage of a student's completed tests in that Room. Show rank, student, average, tests completed. Redis sorted set; rebuild from PostgreSQL on cache miss.

**Global weekly leaderboard**
```
Global Score = 0.70 * AvgPercentage + 0.20 * Accuracy + 0.10 * Participation
Minimum: 3 completed tests in the current week
```
Steps: filter attempts to current week → group by student → compute → rank → cache in Redis (refresh via cron or on submit). Show top students only. Define "Participation" clearly (e.g. min(testsThisWeek / 5, 1) * 100) and keep it adjustable.

---

## 7. Development Roadmap

Each phase ends with a **Done when** check. Follow: `Run → Test → Fix → Commit → Next`.

### Phase 0 — Planning
- Freeze MVP scope. Confirm schema and API list.
- Create accounts: Neon, Redis, Qdrant (optional), LLM key.
- Create Git repo, `.gitignore`, `.env.example`.
- **Done when:** schema and screens are agreed.

### Phase 1 — Foundation
- Create `frontend/` (Next.js, TS) and `backend/` (NestJS, TS).
- Connect Neon via Prisma. First migration.
- Env config, CORS, global validation pipe, `/health` endpoint.
- **Done when:** frontend successfully calls backend `/health`.

### Phase 2 — Authentication
- Register, login, `me`. Password hashing (bcrypt). JWT. Role guards.
- Frontend: login/register pages, protected routes, role-based dashboards.
- **Done when:** teacher and student log in and see different dashboards; teacher-only endpoints reject students.

### Phase 3 — Rooms
- Create Room + code generator. Join by code. My rooms list. Room page.
- QR code (generate for teacher, scan/enter for student). Link `/join/[roomCode]` with Room preview.
- **Done when:** teacher creates Room; student joins via code, QR, and link.

### Phase 4 — Manual Tests (no AI)
- Create test, add/edit/delete questions manually, DRAFT → PUBLISHED.
- Student: start test, timer, navigation, submit confirmation.
- Server grades, saves attempt + answers, blocks duplicates. Result page.
- **Done when:** full manual test flow works end to end. *(This is the fallback demo.)*

### Phase 5 — PDF Processing
- Upload endpoint: validate type (PDF), limit size, store file.
- Extract text, clean, chunk (e.g. 500–800 tokens, small overlap).
- Generate embeddings, store in Qdrant with `documentId` and `roomId` metadata.
- **Done when:** a topic query returns relevant chunks. Test this before using the LLM.

### Phase 6 — AI Question Generation
- Retrieve chunks → build prompt → call LLM → parse JSON → validate → retry on failure.
- Save as DRAFT. Review UI: edit, delete, regenerate. Publish.
- Rate-limit AI endpoint.
- **Done when:** PDF → 10 questions → teacher reviews → published test.

### Phase 7 — Room Leaderboard
- Aggregate per student. Redis sorted set. Update on submit. Rebuild from DB.
- UI table with current student highlighted.
- **Done when:** rank updates right after a submission.

### Phase 8 — Global Weekly Leaderboard
- Weekly filter, global score, min-3-tests rule, Redis cache, refresh job.
- UI: podium (top 3) + table + info tooltip + week date range.
- **Done when:** correct ranks appear from seeded data.

### Phase 9 — Dashboards & Results
- Teacher: stat cards, Room overview, per-test results (attempts, avg/high/low, student table).
- Student: dashboard, profile, recent tests, personal summary.
- **Done when:** both dashboards show real data.

### Phase 10 — Polish & Security
- Loading, empty, and error states. Toasts. Form validation. Mobile layout for test screen.
- Security checklist (section 9).
- **Done when:** no broken states; checklist passes.

### Phase 11 — Demo Prep
- Seed data: demo Room, students, attempts (so global board is not empty).
- Pre-generate a backup test and keep the demo PDF ready.
- Run the full demo path 5+ times. Record a backup video.
- **Done when:** demo runs reliably.

### Phase 12 — Deploy
- Frontend → Vercel. Backend → Render/Railway/Fly. Set prod env vars, run migrations, check CORS and QR/link domain.
- **Done when:** full flow works on the live URL.

---

## 8. UI Guidelines

Modern education SaaS: clean, minimal, professional, light background, dark text, one accent color, rounded cards, subtle borders, restrained shadows, accessible contrast, responsive (desktop-first teacher, mobile-friendly student). Avoid gradients, neon/gaming look, clutter, heavy animation.

**Screens:** Landing, Login/Register, Teacher Dashboard, Create Room, Teacher Room page (Overview/Tests/Students/Leaderboard), Create Test (3 steps: upload → configure → review), Student Dashboard, Join Room (+ `/join/[code]` preview), Test Screen (timer, question nav, progress), Submit modal, Result page, Room Leaderboard, Global Weekly Leaderboard, Student Profile, Teacher Results, plus empty / loading / error states.

Every action must give clear feedback.

---

## 9. Security Checklist

- [ ] Passwords hashed, never stored plain
- [ ] JWT auth + role-based authorization on every protected route
- [ ] Validate all request bodies
- [ ] Validate upload type, limit PDF size
- [ ] Rate-limit AI generation and login
- [ ] Verify Room membership before test access
- [ ] Server-side grading and timer
- [ ] Prevent duplicate submissions
- [ ] Correct answers never sent to students before submit
- [ ] Do not expose private student data on leaderboards beyond name/score
- [ ] `.env` and secrets not in Git

---

## 10. Final Demo Script

1. Teacher logs in.
2. Creates `BCA 5th Semester - DBMS` (code `K7M4P2`).
3. Shows QR.
4. Student scans and joins.
5. Teacher uploads `DBMS Unit 1.pdf`.
6. AI generates 10 MCQs.
7. Teacher reviews and publishes.
8. Student opens and completes the test.
9. Server evaluates. Student sees `Score 9/10, 90%, Room Rank #2`.
10. Room leaderboard updates.
11. Show Global Weekly Leaderboard.

**Success criteria:** this whole path works reliably.

**Talking points:** (1) RAG-based PDF → test generation, (2) Room-based assessment with live leaderboard, (3) cross-room weekly performance analysis.

---

## 11. If Time Runs Short

**Cut first:** Qdrant (send text straight to LLM), dashboard extras, global leaderboard polish.
**Never cut:** Rooms, tests, server grading, Room leaderboard.

## 12. Known Limitations (be honest in the pitch)

- MCQs test recall only.
- No proctoring, so scores depend on student honesty.
- Global ranking compares different tests; difficulty is not normalized.
- Scanned PDFs need OCR (not in MVP).

## 13. Post-MVP Ideas

Weak-topic practice, more question types, teacher analytics, institution dashboards, basic proctoring (tab-switch detection), OCR, difficulty-normalized global score.
