# AiCamAssist
One camera, one profile, full independence — Bit N Build Track 1: Access & Inclusion.

Covers 01 Public Space Navigation, 02 Adaptive Educational Tech, 03 Inclusive Digital Services in one 3-tab PWA + Rust API.

## Team
im sunrays btw
im molicherry btw
im anxiety btw
im nate btw

---

# VerityAI — local-first AI study workspace

VerityAI turns lecture recordings, PDFs, slides, and web articles into a searchable knowledge base with a source-grounded assistant, two-voice podcasts, spaced-repetition flashcards, and topic-tracked quizzes — all stored locally.

## Architecture

```
┌──────────────────────── Next.js App Router (src/) ────────────────────────┐
│ UI (React)                           │ Local API routes                   │
│ • Notes hub / tree navigator         │ /api/subjects   collections, export│
│ • Editor + Verity assistant          │ /api/notes      CRUD, search, sum  │
│ • Podcasts / Flashcards / Quizzes    │ /api/import     PDF·DOCX·PPTX·URL  │
│ • Onboarding, Settings               │ /api/transcribe Whisper (local)    │
│                                      │ /api/chat       hybrid RAG         │
│                                      │ /api/generate   podcast/cards/quiz │
│                                      │ /api/settings   encrypted keys     │
│                                      │ /api/ai         status, tests      │
├──────────────────────────────────────┴────────────────────────────────────┤
│ src/lib/ai/provider.ts  one interface → Gemini · Claude · Ollama · llama   │
│ src/lib/rag.ts          chunking · embeddings · BM25+cosine fusion        │
│ src/db                  Drizzle schema; PGlite (embedded) or PostgreSQL   │
└───────────────────────────────────────────────────────────────────────────┘
```

* **Universal inference** — the backend chosen at first launch powers RAG search, summaries, podcast scripts, flashcards, and quizzes (`src/lib/ai/provider.ts`).
* **Persistence** — notes, chunks + embeddings, chats, generated assets, review schedules, and quiz attempts live in one PostgreSQL-dialect schema (`src/db/schema.ts`). The default engine is embedded PGlite in `./.verity/database`; nothing is re-parsed when a collection is reopened.
* **Scope model** — every AI feature runs against a *chapter* or an *entire subject* (all chapters aggregated).
* **Zero pre-loaded data** — the library starts empty with guided zero states.

## Running the application

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

To use an external PostgreSQL database instead of embedded PGlite, configure `DATABASE_URL` in your environment.

## Local data layout (`./.verity`)

| Path | Contents |
| --- | --- |
| `database/` | PGlite database (all notes, embeddings, chats, decks, quizzes, settings) |
| `local.key` | 32-byte key used to encrypt API keys at rest (AES-256-GCM) |
| `models/` | Whisper ONNX weights cached after first transcription |
| `logs/diagnostics.log` | Diagnostic log (only if the user opts in) |

Migrations for PGlite are generated with `npx drizzle-kit generate` into `drizzle/` and applied automatically on startup.

## AI backends

| Backend | Setup | Embeddings | Data leaves PC? |
| --- | --- | --- | --- |
| Google Gemini | API key (AI Studio) | `gemini-embedding-001` | Yes — only when an AI action runs, after explicit consent |
| Anthropic Claude | API key | none → on-device BM25 retrieval | Yes — same consent |
| Ollama | Local runtime; models (e.g. `qwen2.5:7b-instruct`, `qwen3:8b`) downloadable from the app | `nomic-embed-text` (optional) | No |
| llama.cpp / LM Studio | OpenAI-compatible local server | `/v1/embeddings` if enabled | No |

Speech-to-text is always local (Whisper via Transformers.js); text-to-speech uses Windows voices.

## Publisher configuration

Set these at build time so About/legal pages show verified details instead of the labelled placeholders:

```
NEXT_PUBLIC_PUBLISHER_NAME, NEXT_PUBLIC_PUBLISHER_ENTITY, NEXT_PUBLIC_PUBLISHER_ADDRESS,
NEXT_PUBLIC_SUPPORT_EMAIL, NEXT_PUBLIC_PRIVACY_EMAIL, NEXT_PUBLIC_PUBLISHER_WEBSITE
```

## Compliance summary

* No analytics, cookies, crash upload, or telemetry endpoint; diagnostics are opt-in and local (`/legal/telemetry`).
* Explicit consent checkboxes on setup, API-key entry, and every import.
* Legal pages: Privacy, Terms (AI hallucination disclaimer), Telemetry, License/Refunds/Support, Accessibility, Open-source licenses.
* WCAG 2.1 AA practices: semantic landmarks, keyboard operation of all controls (menus, tree, flashcards, quizzes, player), visible focus rings, high-contrast tokens, ARIA live regions, reduced-motion support.
* Assets: Lucide icons (ISC), system fonts, original icon, no stock media — see `THIRD_PARTY_NOTICES.md`.
