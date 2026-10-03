function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
(async () => {
  const container = document.querySelector("#singlePost");
  const slugMatch = location.pathname.match(/^\/p\/(.+)$/);
  const id = new URLSearchParams(location.search).get("id");
  if (!slugMatch && !id) { container.innerHTML = "<h1>Post not found</h1><p><a href='/'>Back to the blog</a></p>"; return; }
  const endpoint = slugMatch ? `/api/posts/slug/${encodeURIComponent(decodeURIComponent(slugMatch[1]))}` : `/api/posts/${encodeURIComponent(id)}`;
  const response = await fetch(endpoint);
  if (!response.ok) { container.innerHTML = "<h1>Post not found</h1><p><a href='/'>Back to the blog</a></p>"; return; }
  const post = await response.json();
  document.title = `${post.title} — Simple Blog`;
  container.innerHTML = `${post.cover_image_url ? `<img class="single-cover" src="${escapeHtml(post.cover_image_url)}" alt="">` : ""}<p class="post-date">${formatDate(post.created_at)} · ${escapeHtml(post.username)}</p><h1 class="post-title">${escapeHtml(post.title)}</h1><div class="post-body single-post-body">${renderMarkdown(post.body)}</div><p class="back-link"><a href="/">← Back to all posts</a></p>`;
})();
