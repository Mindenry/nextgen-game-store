# OAuth Setup (Google / Facebook / Discord)

The app supports social sign-in **only through Supabase Auth**. In local mode the buttons are
shown as *Setup required* and do nothing harmful; no fake OAuth is implemented. When Supabase
reports a provider enabled, the button appears and uses the PKCE authorization-code flow.

## 1. Switch to Supabase mode

`runtimeMode` becomes `supabase` when all three are set:

```
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Local session auth is used only in development; profiles created locally do not carry passwords in
Supabase. Use a fresh production database when switching.

## 2. Configure URLs in Supabase

Authentication → URL Configuration:

- **Site URL**: `https://your-domain.com`
- **Redirect URLs**:
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/auth/confirm`
  - `http://localhost:3000/auth/callback` (dev)
  - `http://localhost:3000/auth/confirm` (dev)

Email templates (Confirm signup / Magic link / Recovery) should link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
```

Password recovery can use `/auth/callback?next=/reset-password` when using the PKCE code flow.

## 3. Google

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (Web).
2. Authorized JavaScript origins: `https://<ref>.supabase.co`
3. Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
4. Supabase → Authentication → Providers → Google: enable, paste Client ID + Client Secret.
5. No client secret is added to the Next.js environment.

## 4. Facebook

1. Meta for Developers → Create app → Facebook Login → Settings.
2. Valid OAuth Redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
3. App domains: `<ref>.supabase.co` and your store domain.
4. Supabase → Providers → Facebook: enable, paste App ID + App Secret.
5. To let anyone sign in, switch the Meta app from Development to Live and complete the required
   privacy/terms links.

## 5. Discord

1. Discord Developer Portal → New Application → OAuth2.
2. Redirect: `https://<ref>.supabase.co/auth/v1/callback`
3. Copy Client ID + Client Secret into Supabase → Providers → Discord, enable.
4. Scopes required: `identify email`.

## 6. Verify

1. Sign out of the store.
2. `/login` — enabled providers show active buttons; disabled ones show **Setup required**.
3. Complete consent; you are redirected to `/auth/callback?code=…&next=…`.
4. The route exchanges the code, validates the Supabase user, ensures the profile row exists, then
   redirects to the safe relative `next` path.
5. The user appears in `profiles` with role `customer` and a wallet (DB trigger).

## 7. Security notes

- Redirect targets are restricted to same-origin relative paths (`safeNextPath`).
- The service role key is never used in the OAuth flow and never exposed to the client.
- `auth/callback` and `auth/confirm` validate state/PKCE through Supabase.
- Account enumeration: password reset always responds neutrally.
- If a provider is not enabled, the server also rejects the OAuth action (not just the UI).
- Suspended accounts are rejected after the Supabase session resolves.
- Admin roles are **not** assigned by OAuth metadata; assign them in Admin → Staff only.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Redirected back to `/login?error=oauth` | Redirect URL mismatch in provider or Supabase. |
| `redirect_uri_mismatch` | Must be the Supabase callback URL, not the app URL. |
| Buttons show *Setup required* | Provider not enabled in Supabase, or `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` missing. |
| Profile missing after login | Check the Supabase auth trigger migration; the app also self-heals on first request. |
| `next` ignored | Only relative paths are allowed (open-redirect protection). |
