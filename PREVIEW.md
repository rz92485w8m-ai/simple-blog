# Review Beyond the Persona before publication

The redesign is on the local branch `redesign/editorial-review`. Main, production configuration, database migrations and `server.js` are unchanged. No push or deployment is required to review it.

## Local visual preview

With Node.js 20 or later, from the repository directory:

```sh
git switch redesign/editorial-review
npm run preview
```

Open http://localhost:3001. The preview script uses only Node's built-in modules, so it works without installing dependencies or creating an `.env` file. It binds to your own computer's loopback interface.

Review Home, Essays, an individual sample essay, About and Contact. Resize the browser or use mobile device emulation. All preview pages have a prominent preview label. The sample essays are identified as demonstration content, not writing or experiences attributed to Paula. They are never saved to a database.

Stop the preview with Ctrl+C. If the port is already used, set `PREVIEW_PORT` to another port when running the command (for example, `PREVIEW_PORT=3005 npm run preview` on macOS/Linux).

This preview is read-only: it does not load `.env`, initialise Supabase, start the production server, or support login/publishing. Use the automated isolated tests below to check the real application workflows without production access.

## Content requiring Paula's input

- `public/about.html`: the clearly marked biography placeholder.
- `public/js/site.js`: the currently empty `email` and `linkedin` fields. They populate Contact and footer links when supplied. Do not add credentials here; these are public contact details only.
- The Contact page displays marked placeholders until those details are supplied. Its introductory wording and the homepage copy are editorial drafts for review.

## Run the isolated regression tests

```sh
npm ci
npx playwright install chromium
npm test
```

If Chromium is already installed, use its executable instead of downloading a browser. On Linux:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm test
```

Tests run the unchanged Express application with the `pg` module substituted by a disposable `pg-mem` database. They prevent `.env` loading and disable Supabase configuration in the child process. Test accounts and posts exist only in memory. Ports 3102 and 3103 are local test ports; set `TEST_PORT` if 3102 is occupied.

Checks cover public pages at 320, 390, 768, 1024 and 1440 pixels; automated WCAG A/AA checks; topic filters; keyboard navigation; reduced motion; text resizing; error/retry, empty and missing-content states; content escaping; author login, drafts, editing, preview, links, publishing, deletion and logout; CSRF and ownership enforcement.

Image-upload UI behavior is tested with an intercepted response. The real route's unavailable-storage response is also checked. Real Supabase uploads, production cookies/proxy behavior and the live PostgreSQL schema are deliberately not tested.

Review screenshots are written to ignored `work/review/`. Automated checks supplement, but do not replace, visual and assistive-technology review.

## Publication remains a separate decision

Do not push this branch until Render's auto-deploy/preview settings have been checked. The repository does not contain Render's current branch configuration. This implementation has not been pushed, merged or deployed.

The final review package includes the complete source and a patch against commit `8a9cf79`. If reviewing a downloaded source archive rather than the local Git checkout, extract it and run `npm run preview` directly; a branch switch is unnecessary.
