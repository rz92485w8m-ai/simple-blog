# Simple Blog

A small full-stack blog built with:

- HTML5
- CSS
- Vanilla JavaScript
- Node.js + Express
- PostgreSQL
- Supabase for hosted PostgreSQL
- Render for hosting

## Features

- Public homepage
- Author login
- Password hashing with bcrypt
- Session-based authentication
- Facebook-style post composer
- Publish posts
- Delete your own posts
- Responsive design
- Basic security headers and login rate limiting

## 1. Install Node.js

Use Node.js 20 or newer.

Then:

```bash
npm install
```

## 2. Create a Supabase database

Create a project at https://supabase.com.

Open the SQL Editor and run everything in `schema.sql`.

Then open the project's Connect panel and copy a PostgreSQL connection string. Put it in `.env`.

Example:

```env
DATABASE_URL=your-connection-string
SESSION_SECRET=put-a-long-random-secret-here
PORT=3000
```

Do not commit `.env` to GitHub.

## 3. Create the first author account

Generate a bcrypt password hash with:

```bash
node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('CHANGE-ME', 12))"
```

Then insert the user in Supabase SQL Editor:

```sql
insert into users (username, password_hash)
values ('admin', 'PASTE_THE_HASH_HERE');
```

Use a strong password.

## 4. Run locally

```bash
npm start
```

Open:

http://localhost:3000

Author login:

http://localhost:3000/login.html

## 5. Put it on GitHub

Create a GitHub repository and push this project.

Do NOT push `.env`.

## 6. Deploy to Render

Create a Render Web Service connected to your GitHub repository.

Use:

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

Add these environment variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV=production`

Render will provide an `onrender.com` URL and can automatically redeploy when you push to the connected branch.

For this version, posts are stored in Supabase rather than the Render filesystem, so a Render restart does not erase the blog database.

## Important production notes

- Use a unique, long `SESSION_SECRET`.
- Use a strong author password.
- Never put `DATABASE_URL` in frontend JavaScript.
- Never commit `.env`.
- Before accepting public registrations or many users, add email verification, CSRF protection, stronger account management and moderation features.
