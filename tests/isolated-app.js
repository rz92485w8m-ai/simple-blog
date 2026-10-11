"use strict";
// Run the unchanged Express application against a disposable in-memory database.
// Prevent .env loading and substitute pg before requiring server.js.
const { newDb } = require("pg-mem");
const bcrypt = require("bcryptjs");
const db = newDb();
db.public.none(`
create table users (id bigserial primary key, username varchar(50) unique not null, password_hash text not null, created_at timestamptz default now());
create table posts (id bigserial primary key, title varchar(200) not null, body text not null, author_id bigint not null references users(id), created_at timestamptz default now(), slug varchar(220) unique not null, status varchar(20) default 'published', cover_image_url text, updated_at timestamptz default now(), excerpt varchar(320), categories varchar(200));
create table user_sessions (sid text primary key, sess jsonb not null, expire timestamptz not null);
`);
const pg = db.adapters.createPg();
require.cache[require.resolve("pg")] = {
  id: require.resolve("pg"),
  filename: require.resolve("pg"),
  loaded: true,
  exports: pg,
};
require.cache[require.resolve("dotenv")] = {
  id: require.resolve("dotenv"),
  filename: require.resolve("dotenv"),
  loaded: true,
  exports: { config() {} },
};
process.env.DATABASE_URL = "postgresql://isolated-test-only";
process.env.SESSION_SECRET =
  "isolated-test-session-secret-not-a-production-credential";
process.env.NODE_ENV = "test";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.PORT = process.env.TEST_PORT || "3102";
(async () => {
  const pool = new pg.Pool();
  const hash = await bcrypt.hash("isolated-test-password", 4);
  await pool.query(
    "insert into users (username, password_hash) values ($1, $2)",
    ["test-author", hash],
  );
  await pool.query(
    "insert into users (username, password_hash) values ($1, $2)",
    ["other-author", hash],
  );
  require("../server");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
