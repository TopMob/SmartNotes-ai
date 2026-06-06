# Future Implementation Roadmap

## 1. Unique Usernames / Nicknames
* **Status**: Simulated in UI (can only be changed once, inputs lock after the first change). Allows uppercase letters visually for aesthetic purposes.
* **Planned Backend Work**:
  * Add a `username` column to the `profiles` table in Supabase.
  * Implement a unique constraint (`UNIQUE`) on the `username` column using a case-insensitive collation or index (e.g., lower(username)), ensuring case-insensitive uniqueness (T==t).
  * Enforce changing limits: Add a check constraint or a trigger that prevents updating the `username` column if it has already been changed from its original format.
  * Modify authentication routes and forms to allow logging in with either the `email` or the `username` (performing case-insensitive lookups).

## 2. Collaborative Syncing & Sharing via Nickname
* **Status**: In progress (currently using email invitations).
* **Planned Backend Work**:
  * Update folder/note sharing invitations to support recipient usernames/nicknames instead of requiring email.
  * Resolve profile names on the UI automatically based on the unique username database mapping.

## 3. Account Linking (Google OAuth, Email, Username)
* **Status**: Simulated visually under the "Sign-in methods" settings panel.
* **Planned Backend Work**:
  * Configure Supabase Auth to allow multiple provider links for a single user identity.
  * Add backend API handlers/actions to support linking/unlinking OAuth credentials (specifically Google OAuth) to existing credentials-based user profiles.

сделать ТГ бота в супабазе через "Edge Functions" поддержки (тот который уже указан в прокте, щас он сделан через другого бота, надо сделать через "себя")