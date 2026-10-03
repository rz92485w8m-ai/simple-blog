require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const pg = require("pg");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const { Pool } = pg;
const app = express();
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "blog-images";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ["image/jpeg","image/png","image/webp","image/gif"].includes(file.mimetype)) });
function slugify(title) { const base = String(title).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,180) || "post"; return `${base}-${crypto.randomBytes(3).toString("hex")}`; }

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
app.get("/p/:slug", (_req, res) => res.sendFile(path.join(__dirname, "public", "post.html")));

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
        posts.slug,
        posts.cover_image_url,
        users.username
      from posts
      join users on users.id = posts.author_id
      where posts.status = 'published'
      order by posts.created_at desc
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load posts." });
  }
});


app.get("/api/admin/posts", requireLogin, async (req, res) => {
  try { const r = await pool.query("select id,title,body,slug,status,cover_image_url,created_at,updated_at from posts where author_id=$1 order by updated_at desc", [req.session.user.id]); res.json(r.rows); }
  catch (e) { console.error(e); res.status(500).json({error:"Could not load posts."}); }
});
app.get("/api/posts/slug/:slug", async (req,res) => {
  try { const r=await pool.query(`select posts.id,posts.title,posts.body,posts.slug,posts.cover_image_url,posts.created_at,users.username from posts join users on users.id=posts.author_id where posts.slug=$1 and posts.status='published'`,[req.params.slug]); if(!r.rowCount)return res.status(404).json({error:"Post not found."});res.json(r.rows[0]); } catch(e){console.error(e);res.status(500).json({error:"Could not load the post."});}
});
app.post("/api/upload", requireLogin, upload.single("image"), async (req,res) => {
  try { if(!supabase)return res.status(503).json({error:"Image storage is not configured yet."}); if(!req.file)return res.status(400).json({error:"Choose a JPG, PNG, WebP or GIF under 5 MB."}); const ext=(req.file.originalname.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase(); const key=`covers/${req.session.user.id}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`; const {error}=await supabase.storage.from(storageBucket).upload(key,req.file.buffer,{contentType:req.file.mimetype}); if(error)throw error; const {data}=supabase.storage.from(storageBucket).getPublicUrl(key); res.json({url:data.publicUrl}); } catch(e){console.error(e);res.status(500).json({error:"Image upload failed."});}
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      select posts.id, posts.title, posts.body, posts.slug, posts.status, posts.cover_image_url, posts.created_at, users.username
      from posts
      join users on users.id = posts.author_id
      where posts.id = $1
    `, [req.params.id]);

    if (!result.rowCount) return res.status(404).json({ error: "Post not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the post." });
  }
});

app.post("/api/posts", requireLogin, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const status = req.body.status === "draft" ? "draft" : "published";
    const cover = req.body.cover_image_url ? String(req.body.cover_image_url) : null;

    if (!title || !body) {
      return res.status(400).json({ error: "Title and post text are required." });
    }

    if (title.length > 200 || body.length > 20000) {
      return res.status(400).json({ error: "The post is too long." });
    }

    const result = await pool.query(
      `insert into posts (title, body, author_id, slug, status, cover_image_url)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [title, body, req.session.user.id, slugify(title), status, cover]
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

app.put("/api/posts/:id", requireLogin, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const status = req.body.status === "draft" ? "draft" : "published";
    const cover = req.body.cover_image_url ? String(req.body.cover_image_url) : null;
    if (!title || !body) return res.status(400).json({ error: "Title and post text are required." });
    if (title.length > 200 || body.length > 20000) return res.status(400).json({ error: "The post is too long." });

    const result = await pool.query(
      `update posts set title=$1, body=$2, status=$3, cover_image_url=$4, updated_at=now() where id=$5 and author_id=$6 returning *`,
      [title, body, status, cover, req.params.id, req.session.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Post not found." });
    res.json({ ...result.rows[0], username: req.session.user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update the post." });
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


app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found." });
  }
  if (req.method === "GET") {
    return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  }
  next();
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Blog running on http://localhost:${port}`);
});
