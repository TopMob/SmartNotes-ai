# Environment Variables

> Required environment variables for running SmartNotes AI.

---

## Primary Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key. Preferred over `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy alias for publishable key. Used as fallback if `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is not set | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, never expose to client) | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Client ID (inlined into client bundle for One Tap) | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_ID` | Server-side fallback for Google Client ID (used in `/api/supabase/config` if `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is absent) | Google Cloud Console → Credentials |
| `OPENROUTER_BASE_URL` | Base URL for the OpenAI-compatible completions API (defaults to `https://openrouter.ai/api/v1`. Configure as `https://codex.sale/v1` for Codex Sale) | https://openrouter.ai/ or https://codex.sale |
| `OPENROUTER_API_KEY` | API key for OpenRouter or Codex Sale completions | Provider's Dashboard |
| `OPENROUTER_MODEL` | Completions model identifier (defaults to `openai/gpt-4o-mini`. Set to `gpt-5.4` or `gpt-5.5` for Codex Sale) | Provider's Dashboard |
| `AI_ADMIN_SECRET` | Secret token for admin-level AI API calls (bypasses user auth when `x-secret` header matches) | Generate: `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins for AI API routes (defaults to `http://localhost:3000`) | Set to your production domain(s) |

---

## Self-Hosted / Alternative Deployment Aliases

These `SMARTNOTES_*` aliases are checked as fallbacks when the primary variables are absent — useful for self-hosted or container deployments where env prefixing differs.

| Alias | Fallback For |
|-------|-------------|
| `NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SMARTNOTES_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SMARTNOTES_SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
| `NEXT_PUBLIC_SMARTNOTES_GOOGLE_CLIENT_ID` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |

---

## Supabase Dashboard Configuration (Not in .env)

The following are configured directly in the Supabase Dashboard under Authentication providers — they are **not read by the Next.js code**:

- `GOOGLE_CLIENT_SECRET` — Supabase Auth handles server-side OAuth; the secret is stored in the Supabase Dashboard.
- `GOOGLE_REDIRECT_URI` — The callback URL is configured in Supabase Dashboard + Google Cloud Console.

---

## .env.example

A reference `.env.example` file is provided in the project root. Copy it to `.env` and fill in the values:

```bash
cp .env.example .env
```

> **Never commit a `.env` file containing actual secrets.**