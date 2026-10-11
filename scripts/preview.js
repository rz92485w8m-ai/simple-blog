"use strict";
// Local, read-only visual preview. Does not load .env, server.js or a database client.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../public");
const samplePosts = [
  {
    id: 1,
    slug: "preview-the-question-of-self",
    title: "The question of self",
    excerpt:
      "Preview-only sample. A closer look at how we construct identity, and what remains when the roles fall away.",
    categories: "Consciousness, Identity",
    created_at: "2026-01-03T12:00:00Z",
    cover_image_url: null,
    body: "This is **preview-only sample content**. It exists to show typography, paragraph spacing and navigation. It is not a published essay or a personal experience attributed to Paula.\n\n## A place for a question\n\nA long-form essay needs room to breathe. A comfortable line length, clear contrast and generous spacing keep the focus on the writing. This paragraph demonstrates the reading measure across desktop and mobile screens.\n\n*Italic text* and **emphasis** remain supported by the existing editor.\n\n## Following a thought\n\n- A clear heading hierarchy\n- A quiet, readable page\n- Space between ideas\n\nA link to the [essay archive](http://localhost:3001/essays.html) demonstrates inline link styling.\n\nThe final essay text will come from the existing publishing system. No sample content is stored in your database.",
  },
  {
    id: 2,
    slug: "preview-mind-and-machine",
    title: "Mind and machine",
    excerpt:
      "Preview-only sample. Exploring the relationship between human intelligence and artificial intelligence.",
    categories: "Artificial Intelligence, Philosophy",
    created_at: "2026-01-02T12:00:00Z",
    cover_image_url: null,
    body: "Preview-only sample content.\n\n## Reading with attention\n\nThis sample demonstrates the article layout. Replace it through the existing publishing workflow with your own writing.",
  },
  {
    id: 3,
    slug: "preview-a-human-perspective",
    title: "A more human future",
    excerpt:
      "Preview-only sample. On what we can choose, what we can shape, and what still matters.",
    categories: "Life, Reflection",
    created_at: "2025-12-28T12:00:00Z",
    cover_image_url: null,
    body: "Preview-only sample content.\n\n## The human condition\n\nA short demonstration of the literary page design.",
  },
];
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
const server = http.createServer((req, res) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  res.setHeader("Cache-Control", "no-store");
  const json = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  if (!["GET", "HEAD"].includes(req.method))
    return json(405, {
      error:
        "This preview is read-only. Publishing and authentication are available only through the real application.",
    });
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
  } catch {
    return json(400, { error: "Invalid URL" });
  }
  if (pathname === "/api/posts") return json(200, samplePosts);
  if (pathname.startsWith("/api/posts/slug/")) {
    const post = samplePosts.find(
      (p) => p.slug === pathname.slice("/api/posts/slug/".length),
    );
    return json(post ? 200 : 404, post || { error: "Post not found" });
  }
  if (pathname === "/api/me") return json(200, { loggedIn: false });
  if (pathname.startsWith("/api/"))
    return json(404, { error: "Not available in this read-only preview" });
  let file = path.resolve(
    root,
    "." +
      (pathname === "/"
        ? "/index.html"
        : pathname.startsWith("/p/")
          ? "/post.html"
          : pathname),
  );
  if (!file.startsWith(root + path.sep))
    return json(403, { error: "Forbidden" });
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const extension = path.extname(file);
    // Label all preview pages without changing production HTML.
    if (extension === ".html")
      body = Buffer.from(
        body
          .toString()
          .replace(
            /<body\b[^>]*>/,
            '$&<div class="preview-banner" role="note">LOCAL DESIGN PREVIEW · sample essays only · no database connection</div>',
          ),
      );
    res.writeHead(200, {
      "Content-Type": types[extension] || "application/octet-stream",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  });
});
if (require.main === module) {
  const port = Number(process.env.PREVIEW_PORT || 3001);
  const host = process.env.PREVIEW_HOST || "127.0.0.1";
  server.on("error", (error) => {
    console.error(
      `Preview could not start on ${host}:${port}: ${error.message}`,
    );
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`Read-only design preview listening on ${host}:${port}`);
    console.log(
      host === "127.0.0.1"
        ? `Open http://localhost:${port} on the same computer. Cloud workspaces require a supported forwarded-port URL.`
        : `Use your cloud workspace's forwarded-port URL for port ${port}; a Windows localhost link will not reach this server.`,
    );
  });
}
module.exports = { server, samplePosts };
