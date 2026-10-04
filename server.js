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


class PostgresSessionStore extends session.Store {
  constructor(dbPool) {
    super();
    this.pool = dbPool;
  }

  get(sid, callback) {
    this.pool.query(
      "select sess from user_sessions where sid = $1 and expire > now()",
      [sid]
    ).then((result) => {
      if (!result.rowCount) return callback(null, null);
      callback(null, result.rows[0].sess);
    }).catch(callback);
  }

  set(sid, sess, callback = () => {}) {
    const maxAge = sess.cookie?.maxAge || (1000 * 60 * 60 * 8);
    const expire = new Date(Date.now() + maxAge);
    this.pool.query(
      `insert into user_sessions (sid, sess, expire)
       values ($1, $2::jsonb, $3)
       on conflict (sid)
       do update set sess = excluded.sess, expire = excluded.expire`,
      [sid, JSON.stringify(sess), expire]
    ).then(() => callback(null)).catch(callback);
  }

  destroy(sid, callback = () => {}) {
    this.pool.query("delete from user_sessions where sid = $1", [sid])
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sid, sess, callback = () => {}) {
    const maxAge = sess.cookie?.maxAge || (1000 * 60 * 60 * 8);
    const expire = new Date(Date.now() + maxAge);
    this.pool.query(
      "update user_sessions set expire = $2 where sid = $1",
      [sid, expire]
    ).then(() => callback(null)).catch(callback);
  }
}


app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name: "btp.sid",
  store: new PostgresSessionStore(pool),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));



const sessionCleanupTimer = setInterval(() => {
  pool.query("delete from user_sessions where expire <= now()")
    .catch((err) => console.error("Session cleanup failed:", err.message));
}, 1000 * 60 * 60);
sessionCleanupTimer.unref();

function getCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  return req.session.csrfToken;
}

function requireCsrf(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const expected = getCsrfToken(req);
  const supplied = String(req.get("x-csrf-token") || "");
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "Invalid security token. Refresh the page and try again." });
  }
  next();
}

app.get("/api/csrf", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ csrfToken: getCsrfToken(req) });
});

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api", requireCsrf);

app.use(express.static(path.join(__dirname, "public")));
app.get("/p/:slug", (_req, res) => res.sendFile(path.join(__dirname, "public", "post.html")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many changes. Try again later." }
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
    username: req.session.user?.username || null,
    csrfToken: getCsrfToken(req)
  });
});

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !password || username.length > 50 || password.length > 200) {
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

    req.session.regenerate((sessionErr) => {
      if (sessionErr) {
        console.error(sessionErr);
        return res.status(500).json({ error: "Login failed." });
      }
      req.session.user = { id: user.id, username: user.username };
      const csrfToken = getCsrfToken(req);
      res.json({ ok: true, username: user.username, csrfToken });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("btp.sid", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
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
        posts.excerpt,
        posts.categories,
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
  try { const r = await pool.query("select id,title,body,slug,status,cover_image_url,excerpt,categories,created_at,updated_at from posts where author_id=$1 order by updated_at desc", [req.session.user.id]); res.json(r.rows); }
  catch (e) { console.error(e); res.status(500).json({error:"Could not load posts."}); }
});
app.get("/api/posts/slug/:slug", async (req,res) => {
  try { const r=await pool.query(`select posts.id,posts.title,posts.body,posts.slug,posts.cover_image_url,posts.excerpt,posts.categories,posts.created_at,users.username from posts join users on users.id=posts.author_id where posts.slug=$1 and posts.status='published'`,[req.params.slug]); if(!r.rowCount)return res.status(404).json({error:"Post not found."});res.json(r.rows[0]); } catch(e){console.error(e);res.status(500).json({error:"Could not load the post."});}
});
function validImageSignature(buffer, mimetype) {
  if (!buffer || buffer.length < 12) return false;
  if (mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mimetype === "image/gif") return ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
  if (mimetype === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function safeCoverUrl(value) {
  if (!value) return null;
  if (!process.env.SUPABASE_URL) throw new Error("Image storage is not configured.");
  const u = new URL(String(value));
  const project = new URL(process.env.SUPABASE_URL);
  const prefix = `/storage/v1/object/public/${storageBucket}/`;
  if (u.protocol !== "https:" || u.hostname !== project.hostname || !u.pathname.startsWith(prefix)) {
    throw new Error("Invalid cover image URL.");
  }
  return u.toString();
}

app.post("/api/upload", requireLogin, writeLimiter, upload.single("image"), async (req,res) => {
  try { if(!supabase)return res.status(503).json({error:"Image storage is not configured yet."}); if(!req.file)return res.status(400).json({error:"Choose a JPG, PNG, WebP or GIF under 5 MB."}); if(!validImageSignature(req.file.buffer, req.file.mimetype)) return res.status(400).json({error:"The uploaded file is not a valid supported image."}); const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"})[req.file.mimetype]; const key=`covers/${req.session.user.id}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`; const {error}=await supabase.storage.from(storageBucket).upload(key,req.file.buffer,{contentType:req.file.mimetype}); if(error)throw error; const {data}=supabase.storage.from(storageBucket).getPublicUrl(key); res.json({url:data.publicUrl}); } catch(e){console.error(e);res.status(500).json({error:"Image upload failed."});}
});

app.get("/api/posts/:id", requireLogin, async (req, res) => {
  try {
    const result = await pool.query(`
      select posts.id, posts.title, posts.body, posts.slug, posts.status, posts.cover_image_url, posts.excerpt, posts.categories, posts.created_at, users.username
      from posts
      join users on users.id = posts.author_id
      where posts.id = $1 and posts.author_id = $2
    `, [req.params.id, req.session.user.id]);

    if (!result.rowCount) return res.status(404).json({ error: "Post not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the post." });
  }
});

app.post("/api/posts", requireLogin, writeLimiter, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const status = req.body.status === "draft" ? "draft" : "published";
    const cover = safeCoverUrl(req.body.cover_image_url);
    const excerpt = String(req.body.excerpt || "").trim().slice(0,320) || null;
    const categories = String(req.body.categories || "").trim().slice(0,200) || null;

    if (!title || !body) {
      return res.status(400).json({ error: "Title and post text are required." });
    }

    if (title.length > 200 || body.length > 20000) {
      return res.status(400).json({ error: "The post is too long." });
    }

    const result = await pool.query(
      `insert into posts (title, body, author_id, slug, status, cover_image_url, excerpt, categories)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [title, body, req.session.user.id, slugify(title), status, cover, excerpt, categories]
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

app.put("/api/posts/:id", requireLogin, writeLimiter, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const status = req.body.status === "draft" ? "draft" : "published";
    const cover = safeCoverUrl(req.body.cover_image_url);
    const excerpt = String(req.body.excerpt || "").trim().slice(0,320) || null;
    const categories = String(req.body.categories || "").trim().slice(0,200) || null;
    if (!title || !body) return res.status(400).json({ error: "Title and post text are required." });
    if (title.length > 200 || body.length > 20000) return res.status(400).json({ error: "The post is too long." });

    const result = await pool.query(
      `update posts set title=$1, body=$2, status=$3, cover_image_url=$4, excerpt=$5, categories=$6, updated_at=now() where id=$7 and author_id=$8 returning *`,
      [title, body, status, cover, excerpt, categories, req.params.id, req.session.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Post not found." });
    res.json({ ...result.rows[0], username: req.session.user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update the post." });
  }
});

app.delete("/api/posts/:id", requireLogin, writeLimiter, async (req, res) => {
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
