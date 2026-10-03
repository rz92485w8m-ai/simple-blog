function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function renderMarkdown(markdown) {
  const safe = escapeHtml(markdown || "").replace(/\r\n?/g, "\n");
  const inline = (text) => text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  const lines = safe.split("\n");
  let html = "";
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const list = trimmed.match(/^[-*]\s+(.+)$/);
    if (list) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(list[1])}</li>`;
      continue;
    }

    closeList();

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html += `<h${level}>${inline(heading[2])}</h${level}>`;
      continue;
    }

    html += `<p>${inline(trimmed)}</p>`;
  }

  closeList();
  return html;
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
