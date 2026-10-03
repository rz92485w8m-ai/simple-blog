require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const pg = require("pg");
const bcrypt = require("bcryptjs");

const { Pool } = pg;
const app = express();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env and add your Supabase connection string.");
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is missing.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, "public")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "You must be logged in." });
  }
  next();
}

app.get("/api/me", (req, res) => {
  res.json({
    loggedIn: Boolean(req.session.user),
    username: req.session.user?.username || null
  });
});

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const result = await pool.query(
      "select id, username, password_hash from users where username = $1",
      [username]
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    req.session.user = { id: user.id, username: user.username };

    res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/posts", async (req, res) => {
  try {
    const result = await pool.query(`
      select
        posts.id,
        posts.title,
        posts.body,
        posts.created_at,
        users.username
      from posts
      join users on users.id = posts.author_id
      order by posts.created_at desc
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load posts." });
  }
});

app.post("/api/posts", requireLogin, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();

    if (!title || !body) {
      return res.status(400).json({ error: "Title and post text are required." });
    }

    if (title.length > 200 || body.length > 20000) {
      return res.status(400).json({ error: "The post is too long." });
    }

    const result = await pool.query(
      `insert into posts (title, body, author_id)
       values ($1, $2, $3)
       returning id, title, body, created_at`,
      [title, body, req.session.user.id]
    );

    res.status(201).json({
      ...result.rows[0],
      username: req.session.user.username
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not publish the post." });
  }
});

app.delete("/api/posts/:id", requireLogin, async (req, res) => {
  try {
    const result = await pool.query(
      "delete from posts where id = $1 and author_id = $2 returning id",
      [req.params.id, req.session.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Post not found." });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete the post." });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Blog running on http://localhost:${port}`);
});
