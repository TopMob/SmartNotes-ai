# Environment Variables

These environment variables are required to run the SmartNotes AI application.

## Primary Variables

| Variable Name | Description | Source / How to get |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The URL of your Supabase project. | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable (anon) key for Supabase client usage. Preferred over `NEXT_PUBLIC_SUPABASE_ANON_KEY`. | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy alias for the Supabase publishable key. Used as fallback if `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is not set. | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | The secret service role key for Supabase administrative operations (server-side only). | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Client ID for Google OAuth / One Tap login (inlined into client bundle). | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_ID` | Server-side fallback for Google Client ID (used in `/api/supabase/config` if `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is absent). | Google Cloud Console → Credentials |
| `OPENROUTER_API_KEY` | API key for OpenRouter — used by AI chat and note analysis features. | https://openrouter.ai/keys |
| `OPENROUTER_MODEL` | OpenRouter model identifier (defaults to `openai/gpt-4o-mini` if not set). | https://openrouter.ai/models |
| `AI_ADMIN_SECRET` | Secret token for admin-level AI API calls (bypasses user auth when `x-secret` header matches). | Generate a random strong string (e.g. `openssl rand -hex 32`) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins for AI API routes (defaults to `http://localhost:3000`). | Set to your production domain(s) |

## Self-Hosted / Alternative Deployment Aliases

These `SMARTNOTES_*` aliases are checked as fallbacks when the primary variables are absent — useful for self-hosted or container deployments where env prefixing differs.

| Variable Name | Fallback For |
|---|---|
| `NEXT_PUBLIC_SMARTNOTES_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SMARTNOTES_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SMARTNOTES_SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
| `NEXT_PUBLIC_SMARTNOTES_GOOGLE_CLIENT_ID` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |

## Not Needed in Code (configured in Supabase Dashboard)

The following are listed in `.env.example` for reference but are **not read by the Next.js code** — they are configured directly in the Supabase Dashboard under Authentication providers:

- `GOOGLE_CLIENT_SECRET` — Supabase Auth handles server-side OAuth; the secret is stored in the Supabase Dashboard.
- `GOOGLE_REDIRECT_URI` — The callback URL is configured in Supabase Dashboard + Google Cloud Console.

*Do not create or commit a `.env` file containing actual secrets. This file serves as documentation.*
