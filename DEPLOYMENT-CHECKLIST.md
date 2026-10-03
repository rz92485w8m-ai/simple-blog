# Final deployment checklist

1. Edit `public/js/site.js` with the real blog name, tagline and author.
2. Keep `.env` out of Git.
3. Confirm Render has DATABASE_URL, SESSION_SECRET, NODE_ENV=production, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
4. Test login, draft, publish, edit, delete, image upload and article links locally.
5. Commit and push to GitHub.
6. Wait for Render to report Live and repeat the tests on the public site.
7. Add a custom domain in Render when ready, then follow Render's DNS instructions at your domain registrar.
8. In Supabase, keep the image bucket public only if cover images must be publicly readable; never expose the server secret key in browser code.
