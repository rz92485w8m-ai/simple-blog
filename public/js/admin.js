async function requireSession() {
  const response = await fetch("/api/me");
  const me = await response.json();

  if (!me.loggedIn) {
    location.href = "/login.html";
    return null;
  }

  document.querySelector("#welcomeName").textContent = me.username;
  document.querySelector(".avatar").textContent = me.username[0].toUpperCase();
  return me;
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

async function loadAdminPosts() {
  const response = await fetch("/api/posts");
  const posts = await response.json();
  const container = document.querySelector("#adminPosts");

  container.innerHTML = posts.map(post => `
    <article class="post-card">
      <div class="post-actions">
        <span class="post-date">${formatDate(post.created_at)}</span>
        <button class="delete-button" data-id="${post.id}">Delete</button>
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <div class="post-body">${escapeHtml(post.body).replaceAll("\n", "<br>")}</div>
    </article>
  `).join("") || '<div class="empty">No posts yet.</div>';

  container.querySelectorAll(".delete-button").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this post?")) return;

      const response = await fetch(`/api/posts/${button.dataset.id}`, {
        method: "DELETE"
      });

      if (response.ok) loadAdminPosts();
    });
  });
}

document.querySelector("#postForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const message = document.querySelector("#postMessage");
  message.textContent = "";

  const response = await fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: form.title.value,
      body: form.body.value
    })
  });

  const data = await response.json();

  if (!response.ok) {
    message.textContent = data.error || "Could not publish.";
    message.className = "message error";
    return;
  }

  form.reset();
  message.textContent = "Published!";
  message.className = "message success";
  loadAdminPosts();
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/";
});

(async () => {
  const me = await requireSession();
  if (me) loadAdminPosts();
})();
