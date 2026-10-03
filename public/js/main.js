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
      ${post.cover_image_url ? `<img class="card-cover" src="${escapeHtml(post.cover_image_url)}" alt="">` : ""}
      <p class="post-date">${formatDate(post.created_at)} · ${escapeHtml(post.username)}</p>
      <h3><a class="post-title-link" href="/p/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
      <div class="post-body post-excerpt">${renderMarkdown(post.body.length > 260 ? post.body.slice(0, 260) + "…" : post.body)}</div>
      <a class="read-more" href="/p/${encodeURIComponent(post.slug)}">Read post →</a>
    </article>
  `).join("");
}

loadSession();
loadPosts();
