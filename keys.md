# Environment Variables

These environment variables are required to run the SmartNotes AI application.

| Variable Name | Description | Source / How to get |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The URL of your Supabase project. | Supabase Dashboard -> Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anonymous public key for Supabase client usage. | Supabase Dashboard -> Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | The secret service role key for Supabase administrative operations. | Supabase Dashboard -> Settings -> API |
| `GOOGLE_CLIENT_ID` | Client ID for Google OAuth / One Tap login. | Google Cloud Console -> Credentials |
| `GOOGLE_CLIENT_SECRET` | Client Secret for Google OAuth. | Google Cloud Console -> Credentials |
| `AI_SERVICE_URL` | URL of the external AI service or proxy used for analysis and embeddings. | Internal configuration |
| `AI_SERVICE_TOKEN` | Secret token to authenticate with the AI service. | Internal configuration |
| `ENCRYPTION_SECRET` | Secret key used to generate timing-safe hashes or lock hashes in the system. | Generate a random strong string (e.g. `openssl rand -hex 32`) |

*Do not create or commit a `.env` file containing actual secrets. This file serves as documentation.*
