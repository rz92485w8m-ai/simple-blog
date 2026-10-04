# Security notes

This build adds: CSRF tokens for state-changing API requests, session regeneration after login, HttpOnly/SameSite/production-Secure cookies, login and write rate limits, Helmet CSP/security headers, parameterized SQL, owner checks on admin post reads/writes, draft protection, Markdown HTML escaping, strict image type/signature/size checks, and restriction of saved cover URLs to the configured Supabase public bucket.

## Deployment checks
- Keep `.env` out of Git. Never expose `DATABASE_URL`, `SESSION_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` in browser code.
- Use a long random `SESSION_SECRET` and a strong admin password.
- Keep Render `NODE_ENV=production`.
- Keep Supabase RLS enabled and do not add broad anon/authenticated policies for the database tables used by this server.
- The `blog-images` bucket is public by design for published cover images. Do not store private images there.
- Rotate a secret immediately if it is ever committed, pasted into a public issue/chat, or otherwise exposed.
- Run `npm audit` periodically and review dependency updates before deploying them.

## Remaining hardening option
`express-session` still uses its default in-memory session store in this small single-instance build. That does not expose the admin password, but sessions are lost on a server restart and the default store is not intended for scaled production use. Before scaling beyond one small instance, move sessions to a persistent store such as PostgreSQL/Redis.
