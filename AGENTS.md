<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Multi-repo workspace root: `/agent/repos/`. This app lives at `/agent/repos/coordiqo`.

- **Install:** `npm install` in this directory (see `package.json` scripts).
- **Env:** Copy `.env.example` to `.env.local`. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required at runtime; `SUPABASE_SERVICE_ROLE_KEY` for admin/server flows. Optional integrations are documented in `.env.example`.
- **Local Supabase:** `supabase/config.toml` is present; run `supabase start` from this repo when you need a real database (requires Docker + Supabase CLI, not installed in the default cloud VM).
- **Dev:** `npm run dev` (default `http://localhost:3000`). When running several Next apps together, set `PORT` (e.g. `PORT=3002 npm run dev`).
- **Lint / build:** `npm run lint`, `npm run build`. ESLint currently reports many pre-existing issues in the repo; builds succeed with valid env.
- **Tests:** No `test` script; no Playwright config in-repo.
