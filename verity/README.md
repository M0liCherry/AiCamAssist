# VerityAI — local-first AI study workspace for Windows

VerityAI turns lecture recordings, PDFs, slides, and web articles into a searchable knowledge base with a source-grounded assistant, two-voice podcasts, spaced-repetition flashcards, and topic-tracked quizzes — all stored on the user's PC.

## Architecture

```
┌──────────────────────────── Electron shell (desktop/) ────────────────────────────┐
│ main.js  → spawns the Next.js standalone server on 127.0.0.1:<free port>          │
│          → NITRO_DATA_DIR=%AppData%\VerityAI, hardened BrowserWindow, native menus │
└───────────────────────────────────────────────────────────────────────────────────┘
                     │ HTTP (loopback only)
┌────────────────────▼──────────── Next.js App Router (src/) ───────────────────────┐
│ Renderer (React)                     │ Local API routes                           │
│ • Notes hub / tree navigator         │ /api/subjects   collections, reorder, export│
│ • Editor + Nitro assistant           │ /api/notes      CRUD, search, summarize     │
│ • Podcasts / Flashcards / Quizzes    │ /api/import     PDF·DOCX·PPTX·URL·YouTube   │
│ • Onboarding, Settings & Legal       │ /api/transcribe Whisper (Transformers.js)   │
│                                      │ /api/chat       hybrid RAG with citations   │
│                                      │ /api/generate   podcast/flashcards/quiz     │
│                                      │ /api/settings   encrypted keys, consents    │
│                                      │ /api/ai         test, Ollama status/pull    │
├──────────────────────────────────────┴────────────────────────────────────────────┤
│ src/lib/ai/provider.ts  one interface → Gemini · Claude · Ollama · llama.cpp      │
│ src/lib/rag.ts          chunking · embeddings (JSON vectors) · BM25+cosine fusion │
│ src/db                  Drizzle schema; PGlite (desktop) or PostgreSQL (server)   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

* **Universal inference** — the backend chosen at first launch powers RAG search, summaries, podcast scripts, flashcards, and quizzes (`src/lib/ai/provider.ts`).
* **Persistence** — notes, chunks + embeddings, chats, generated assets, review schedules, and quiz attempts live in one PostgreSQL-dialect schema (`src/db/schema.ts`). On desktop the engine is PGlite in `%AppData%\VerityAI\database`; nothing is re-parsed when a collection is reopened.
* **Scope model** — every AI feature runs against a *chapter* or an *entire subject* (all chapters aggregated).
* **Zero pre-loaded data** — the library starts empty with guided zero states.

## Running in development (web mode)

```bash
npm install
# DATABASE_URL in .env points at PostgreSQL
npx drizzle-kit push
npm run dev
```

## Building the Windows desktop app

```bash
cd desktop
npm install                 # electron + electron-builder (dev-only)
npm run dist                # → desktop/dist/VerityAI-Setup-1.0.0.exe and VerityAI-1.0.0.appx
```

`scripts/build-renderer.mjs` builds Next.js with `NITRO_DESKTOP_BUILD=1` (standalone output) and copies static assets, `public/`, and the `drizzle/` migrations next to `server.js`. electron-builder packages that folder as `resources/app`.

* **NSIS `.exe`** — per-user installer, custom install directory, uninstaller keeps user data.
* **MSIX/AppX** — for Store or sideloading; set a real `publisher` (`CN=…` matching your code-signing certificate) in `desktop/package.json` before signing.
* Code signing: supply `CSC_LINK`/`CSC_KEY_PASSWORD` (or Azure Trusted Signing) to electron-builder; unsigned builds trigger SmartScreen warnings.

## Local data layout (`%AppData%\VerityAI`)

| Path | Contents |
| --- | --- |
| `database/` | PGlite database (all notes, embeddings, chats, decks, quizzes, settings) |
| `local.key` | 32-byte key used to encrypt API keys at rest (AES-256-GCM) |
| `models/` | Whisper ONNX weights cached after first transcription |
| `logs/desktop.log` | Shell log (always) · `logs/diagnostics.log` (only if the user opts in) |

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
