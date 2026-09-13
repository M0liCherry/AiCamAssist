# Verity AI — Local-First AI Study Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%20x64-0078D6.svg)](#download)
[![Stack: Next.js](https://img.shields.io/badge/Stack-Next.js%2016-black.svg)](#architecture)
[![Database: PGlite / PostgreSQL](https://img.shields.io/badge/DB-PGlite%20%7C%20PostgreSQL-336791.svg)](#architecture)

Verity AI turns lecture recordings, PDFs, slides, and web articles into a searchable
knowledge base with a source-grounded assistant, two-voice podcasts,
spaced-repetition flashcards, and topic-tracked quizzes — all stored locally on
your own machine.

- **Local-first:** notes, embeddings, chats, and generated material live in an
  embedded database. No account, no cloud copy, no telemetry.
- **Bring your own brain:** Google Gemini, Anthropic Claude, Ollama, or any
  OpenAI-compatible local server (llama.cpp, LM Studio).
- **Grounded answers:** every AI feature cites the exact passages it used, so you
  can verify instead of trusting.

## Download

| Platform | Get it |
| --- | --- |
| **Windows 10/11 (x64)** | [**Verity AI Setup 1.0.0.exe**](https://github.com/M0liCherry/AiCamAssist/releases/latest) — double-click to install, runs from the taskbar tray, fully offline |

No installer? Run from source below. No Windows? Deploy the hosted target to
Vercel ([instructions](#deploying-to-vercel-target-b)).

## Features

| Area | What you get |
| --- | --- |
| **Notes hub** | Subjects → chapters → notes tree, full-text + semantic search, JSON/Markdown export |
| **Import** | Blank Markdown docs, audio (local Whisper transcription), documents (PDF, DOCX, PPTX, TXT, MD, HTML), website / YouTube links |
| **Document editor** | Markdown editing with preview, AI summaries, and the Verity assistant side-by-side |
| **Verity assistant** | RAG chat over a chapter or a whole subject, with citations and `@`-mentions to pin notes |
| **Podcasts** | Two-voice (host + guest) audio overviews via system speech, ElevenLabs, or local KokoClone voice cloning, with transcript follow-along |
| **Flashcards** | AI-generated decks with spaced-repetition scheduling (new → learning → mastered) |
| **Quizzes** | Multiple-choice checks with instant explanations and per-topic mastery tracking |
| **Theme studio** | Material You dynamic color — pick a seed color and the whole UI re-themes, light or dark |
| **Trust center** | Privacy Policy, Terms, Telemetry, License, Accessibility, and Open-source licenses built in |

## Quickstart — two targets, one codebase

The same code runs in two modes. Pick the target that fits; there is no fork.

**Target A — Windows / self-hosted (fully offline + local models).**
Uses the embedded PGlite database in `./.verity`, talks to Ollama /
llama.cpp on `127.0.0.1`, runs KokoClone voice cloning with local Python,
and transcribes with local Whisper. Nothing leaves the PC.

```bash
npm install
npm run dev          # develop
npm run build && npm start   # production server on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000). Then install
[Ollama](https://ollama.com/download) (open the app, pull e.g.
`qwen2.5:7b-instruct` + `nomic-embed-text`) and, for voice cloning, Python
3.10+ and the KokoClone setup in Settings. Optional config: copy
`.env.local.example` to `.env.local`.

**Windows desktop app (installer, no terminal).** The same Target A build
packaged with Electron — double-click to install, runs from the taskbar tray,
stays resident on window close, optional start-with-Windows, all data under
`%APPDATA%\Verity AI`:

```bash
npm run dist:win     # produces dist/Verity AI Setup 1.0.0.exe
```

For development, run `npm run dev` in one terminal and
`npm run electron:dev` in another. Notes: KokoClone setup inside the
installed app needs Git + Python on the machine (it clones its engine on
first use); Whisper transcription works out of the box (prebuilt ONNX
runtime ships inside).

**Target B — Hosted (Vercel, cloud API backends only).**
Same app, but `127.0.0.1` is the server, not your PC — so the app
automatically hides Ollama / llama.cpp / KokoClone setup and uses Gemini or
Claude plus System / ElevenLabs voices. Copy `.env.vercel.example` values
into the host's environment (see below).

### Other scripts

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint over the repo |
| `npm run typecheck` | Strict TypeScript check (`tsc --noEmit`) |
| `npm run electron:dev` | Desktop shell against `npm run dev` |
| `npm run dist:win` | Build the Windows installer into `dist/` |

### Deploying to Vercel (Target B)

Vercel's filesystem is ephemeral, so the embedded PGlite database cannot
persist there — point the app at a hosted PostgreSQL database (Vercel
Postgres, Neon, or Supabase). The app detects the hosted target via `VERCEL`
or `VERITY_HOSTED=true` and automatically hides Ollama / llama.cpp /
KokoClone setup in favor of cloud backends:

1. Keep the defaults on the import screen: Next.js preset, root directory
   `./`, default build/output/install commands.
2. In **Environment Variables**, set `DATABASE_URL` to your hosted connection
   string (include `?sslmode=require` if your provider needs it) and
   `VERITY_HOSTED=true`. Optionally set `VERITY_KEY_SECRET` and the
   `NEXT_PUBLIC_*` publisher variables (see `.env.vercel.example`). Do
   **not** set `VERITY_DATA_DIR`.
3. Create the tables once from your machine (requires the repo + dependencies):
   ```bash
   DATABASE_URL="<your-connection-string>" npx drizzle-kit migrate
   ```
4. Deploy. If the app shows "could not start", open
   `https://<your-app>.vercel.app/api/settings` in the browser — the returned
   error names the cause (unreachable database vs. missing tables) — and check
   the function logs in the Vercel dashboard.

Note the Hobby-plan limits: serverless timeouts can interrupt long AI
generations, Whisper transcription, and podcast rendering; local backends
(Ollama, KokoClone) are unreachable from Vercel, so use cloud API keys, and
treat uploads/generated audio as temporary.

### Other scripts

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint over the repo |
| `npm run typecheck` | Strict TypeScript check (`tsc --noEmit`) |

## Configuration

Copy `.env.example` to `.env.local` and adjust as needed.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VERITY_DATA_DIR` | `./.verity` | Local data folder (database, keys, models, logs) |
| `VERITY_MIGRATIONS_DIR` | `./drizzle` | SQL migrations applied automatically on startup |
| `DATABASE_URL` | — | Set to use an external PostgreSQL server instead of embedded PGlite |
| `VERITY_LOCAL_CONTEXT` | `8192` | Context window (tokens) for local AI models |
| `VERITY_KEY_SECRET` | — | Optional secret for API-key encryption; otherwise a key file is generated |
| `NEXT_PUBLIC_PUBLISHER_*` | placeholders | Publisher name, entity, address, support/privacy emails, website shown in About & legal pages |

## AI backends

| Backend | Setup | Embeddings | Data leaves your PC? |
| --- | --- | --- | --- |
| Google Gemini | API key (AI Studio) | `gemini-embedding-001` | Yes — only when an AI action runs, after explicit consent |
| Anthropic Claude | API key | None → on-device BM25 retrieval | Yes — same explicit consent |
| Ollama | Local runtime; download models (e.g. `qwen2.5:7b-instruct`) from inside the app | `nomic-embed-text` (optional) | No |
| llama.cpp / LM Studio | OpenAI-compatible local server | `/v1/embeddings` if enabled | No |

Speech-to-text is always local (Whisper via Transformers.js + ONNX Runtime).
API keys are encrypted at rest with AES-256-GCM.

## Architecture

```
┌──────────────────────── Next.js App Router (src/) ────────────────────────┐
│ UI (React)                           │ Local API routes                   │
│ • Notes hub / tree navigator         │ /api/subjects   collections, export│
│ • Editor + Verity assistant          │ /api/notes      CRUD, search, sum  │
│ • Podcasts / Flashcards / Quizzes    │ /api/import     PDF·DOCX·PPTX·URL  │
│ • Onboarding, Settings, Theme studio │ /api/transcribe Whisper (local)    │
│                                      │ /api/chat       hybrid RAG         │
│                                      │ /api/generate   podcast/cards/quiz │
│                                      │ /api/podcast    voices, TTS audio  │
│                                      │ /api/settings   encrypted keys     │
│                                      │ /api/ai         status, tests      │
├──────────────────────────────────────┴────────────────────────────────────┤
│ src/lib/ai/provider.ts  one interface → Gemini · Claude · Ollama · llama   │
│ src/lib/rag.ts          chunking · embeddings · BM25+cosine fusion        │
│ src/db                  Drizzle schema; PGlite (embedded) or PostgreSQL   │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Scope model** — every AI feature runs against a *chapter* or an *entire
  subject* (all chapters aggregated).
- **Persistence** — notes, chunks + embeddings, chats, generated assets, review
  schedules, and quiz attempts live in one PostgreSQL-dialect schema
  (`src/db/schema.ts`). Nothing is re-parsed when a collection is reopened.
- **Migrations** — SQL in `drizzle/` is applied automatically on startup
  (embedded mode).

## Local data layout

| Path (under `VERITY_DATA_DIR`) | Contents |
| --- | --- |
| `database/` | PGlite database: notes, embeddings, chats, decks, quizzes, settings |
| `local.key` | 32-byte key encrypting API keys at rest (AES-256-GCM) |
| `models/` | Whisper ONNX weights cached after first transcription |
| `media/` | Generated podcast audio |
| `logs/diagnostics.log` | Diagnostic log — only if the user opts in |

## Privacy & compliance

- No analytics, cookies, crash uploads, or telemetry endpoints; diagnostics are
  opt-in and written to a local file only (see `/legal/telemetry`).
- Explicit consent checkboxes on setup, API-key entry, and every import.
- AI limitations (including hallucinations) are disclosed in-app and in
  `/legal/terms`; citations are shown so answers can be checked.
- Accessibility: semantic landmarks, full keyboard operation, visible focus
  rings, high-contrast light/dark tokens, ARIA live regions, reduced-motion
  support — see `/legal/accessibility`.
- Third-party notices: Lucide icons (ISC), system fonts, no bundled stock media —
  see `THIRD_PARTY_NOTICES.md` and `/legal/licenses`.

## Contributors

From the public repository
[M0liCherry/AiCamAssist](https://github.com/M0liCherry/AiCamAssist):

- [M0liCherry](https://github.com/M0liCherry) — Owner & maintainer
- [ArnavPednekar](https://github.com/ArnavPednekar) — Contributor
- [C1ph3r404](https://github.com/C1ph3r404) — Contributor
- [Anxietyop](https://github.com/Anxietyop) — Contributor
- [nate-test-cloud](https://github.com/nate-test-cloud) — Contributor

## License

MIT License © 2026 M0liCherry. See [LICENSE](LICENSE) and the in-app
Open-source licenses page for third-party notices.
