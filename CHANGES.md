# Changes

## d0cb550 — Scaffold 4-member parallel build (2026-09-11)

3-tab frontend + axum station API so 4 members can work in parallel.

### Frontend (`frontend/src/`)
- `App.tsx`: replaced Vite template with tab shell (01 Navigate / 02 Learn / 03 Services) + high-contrast toggle.
- `App.css`: replaced demo styles with accessible tab layout, focus-visible rings, `.hc` high-contrast theme, `.dyslexia` style.
- `types.ts` (new): shared contracts — `Profile`, `Detection`, `StationNode`, `API_BASE`.
- `context/ProfileContext.tsx` (new): `ProfileProvider`, `useProfile`, `speak()` via speechSynthesis.
- `features/navigate/NavigateTab.tsx` (new, M1): camera via getUserMedia, mock detections, stereo-beep + vibrate + speech warn. TODO: plug coco-ssd.
- `features/learn/LearnTab.tsx` (new, M2): text input + dyslexia / ADHD-chunk / plain transforms + read-aloud.
- `features/services/ServicesTab.tsx` (new, M3): fetches `/api/station`, offline fallback, destination guide.

### Backend (`backend/`)
- `Cargo.toml`: added `axum 0.7`, `tokio full`, `tower-http cors`, `serde`, `serde_json`.
- `src/main.rs`: `GET /api/health`, `GET /api/station` mock hub graph (entrance / elevator / escalator / platform-2), permissive CORS on `:3001`.
- `Cargo.lock`: committed.

### Verified
- `cargo check` — ok
- `npm run build` — ok (225 kB JS)
