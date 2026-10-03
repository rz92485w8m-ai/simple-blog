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
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
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
      <p class="post-date">${formatDate(post.created_at)} · ${escapeHtml(post.username)}</p>
      <h3><a class="post-title-link" href="/post.html?id=${post.id}">${escapeHtml(post.title)}</a></h3>
      <div class="post-body post-excerpt">${escapeHtml(post.body.length > 260 ? post.body.slice(0, 260) + "…" : post.body).replaceAll("\n", "<br>")}</div>
      <a class="read-more" href="/post.html?id=${post.id}">Read post →</a>
    </article>
  `).join("");
}

loadSession();
loadPosts();
