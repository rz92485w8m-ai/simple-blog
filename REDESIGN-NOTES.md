# Beyond the Persona redesign

## Before running
Run `editorial-migration.sql` once in Supabase SQL Editor. It adds `excerpt` and `categories` to posts.

## Public navigation
Login is intentionally hidden. Admin still uses `/login.html` and `/admin.html`.

## Social links
Edit `public/js/site.js` and add Paula's LinkedIn URL and email when available. Empty values stay hidden.

## Homepage
The homepage automatically shows the three newest published essays. If there are no posts, it shows a calm empty state rather than fake content.
