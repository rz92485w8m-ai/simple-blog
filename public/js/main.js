async function loadSession() {
  const response = await fetch("/api/me");
  const me = await response.json();

  const adminLink = document.querySelector("#adminLink");
  const loginLink = document.querySelector("#loginLink");
  const logoutButton = document.querySelector("#logoutButton");

  if (me.loggedIn) {
    adminLink?.classList.remove("hidden");
    loginLink?.classList.add("hidden");
    logoutButton?.classList.remove("hidden");

    logoutButton?.addEventListener("click", async () => {
      await fetch("/api/logout", { method: "POST" });
      location.href = "/";
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}


function makeExcerpt(markdown, maxLength = 220) {
  const text = String(markdown || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength
    ? text.slice(0, maxLength).trimEnd() + "…"
    : text;
}

async function loadPosts() {
  const container = document.querySelector("#posts");
  if (!container) return;

  const response = await fetch("/api/posts");
  const posts = await response.json();

  if (!posts.length) {
    container.innerHTML = '<div class="empty">No posts yet.</div>';
    return;
  }

  container.innerHTML = posts.map(post => `
    <article class="post-card">
      ${post.cover_image_url ? `<img class="card-cover" src="${escapeHtml(post.cover_image_url)}" alt="">` : ""}
      <p class="post-date">${formatDate(post.created_at)} · ${escapeHtml(post.username)}</p>
      <h3><a class="post-title-link" href="/p/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
      <div class="post-body post-excerpt">${escapeHtml(makeExcerpt(post.body))}</div>
      <a class="read-more" href="/p/${encodeURIComponent(post.slug)}">Read post →</a>
    </article>
  `).join("");
}

loadSession();
loadPosts();
