let editingId = null;
let csrfToken = "";
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const date = (v) => new Date(v).toLocaleString("en-GB", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});
const topics = () => $("#categories").value.split(",").map(x => x.trim()).filter(Boolean);

async function api(url, options = {}) {
  const opts = { credentials: "same-origin", ...options, headers: { ...(options.headers || {}) } };
  if (["POST", "PUT", "PATCH", "DELETE"].includes((opts.method || "GET").toUpperCase())) opts.headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(url, opts);
  if (response.status === 401) location.href = "/login.html";
  return response;
}

async function load() {
  const r = await api("/api/admin/posts");
  if (!r.ok) return;
  const ps = await r.json();
  $("#adminPosts").innerHTML = ps.map((p) => `<article class="post-card">${p.cover_image_url ? `<img class="card-cover" src="${esc(p.cover_image_url)}" alt="">` : ""}<div class="post-actions"><span>${date(p.updated_at)} · <b>${esc(p.status)}</b></span><div class="action-buttons">${p.status === "published" ? `<a href="/p/${encodeURIComponent(p.slug)}">View</a>` : ""}<button class="edit-button" data-id="${p.id}">Edit</button><button class="delete-button" data-id="${p.id}">Delete</button></div></div><h3>${esc(p.title)}</h3></article>`).join("") || '<div class="empty">No posts yet.</div>';

  document.querySelectorAll(".edit-button").forEach((b) => b.onclick = async () => {
    const r = await api("/api/posts/" + encodeURIComponent(b.dataset.id));
    if (!r.ok) return;
    const p = await r.json();
    editingId = p.id; $("#title").value = p.title; $("#body").value = p.body; $("#excerpt").value = p.excerpt || ""; $("#categories").value = p.categories || ""; $("#status").value = p.status; $("#coverUrl").value = p.cover_image_url || ""; showCover(p.cover_image_url); $("#submitPostButton").textContent = "Save changes"; $("#cancelEditButton").classList.remove("hidden"); scrollTo(0, 0);
  });

  document.querySelectorAll(".delete-button").forEach((b) => b.onclick = async () => {
    if (!confirm("Delete this post?")) return;
    const r = await api("/api/posts/" + encodeURIComponent(b.dataset.id), { method: "DELETE" });
    if (r.ok) load();
  });
}

function showCover(u) { if (u) { $("#coverPreview").src = u; $("#coverPreview").classList.remove("hidden"); } else { $("#coverPreview").removeAttribute("src"); $("#coverPreview").classList.add("hidden"); } }
function reset() { editingId = null; $("#postForm").reset(); $("#coverUrl").value = ""; showCover(); $("#cancelEditButton").classList.add("hidden"); $("#submitPostButton").textContent = "Publish"; }

$("#coverImage").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  $("#uploadStatus").textContent = "Uploading…";
  const fd = new FormData(); fd.append("image", f);
  const r = await api("/api/upload", { method: "POST", body: fd });
  const d = await r.json(); $("#uploadStatus").textContent = r.ok ? "Uploaded" : d.error;
  if (r.ok) { $("#coverUrl").value = d.url; showCover(d.url); }
};

document.querySelectorAll(".editor-toolbar button[data-wrap], .editor-toolbar button[data-prefix]").forEach((b) => b.onclick = () => {
  const t = $("#body"), a = t.selectionStart, z = t.selectionEnd, x = t.value.slice(a, z);
  const replacement = b.dataset.wrap ? b.dataset.wrap + x + b.dataset.wrap : b.dataset.prefix + x;
  t.setRangeText(replacement, a, z, "select"); t.focus();
});

let linkSelectionStart = 0;
let linkSelectionEnd = 0;

function closeLinkModal() {
  $("#linkModal").classList.add("hidden");
  $("#linkError").textContent = "";
}

$("#linkButton").onclick = () => {
  const t = $("#body");
  linkSelectionStart = t.selectionStart;
  linkSelectionEnd = t.selectionEnd;
  $("#linkText").value = t.value.slice(linkSelectionStart, linkSelectionEnd);
  $("#linkUrl").value = "";
  $("#linkError").textContent = "";
  $("#linkModal").classList.remove("hidden");
  setTimeout(() => ($("#linkText").value ? $("#linkUrl") : $("#linkText")).focus(), 0);
};

$("#insertLinkButton").onclick = () => {
  const t = $("#body");
  const text = $("#linkText").value.trim() || "link";
  let url = $("#linkUrl").value.trim();

  if (!url) {
    $("#linkError").textContent = "Enter a web address.";
    return;
  }

  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
    url = parsed.href;
  } catch {
    $("#linkError").textContent = "Enter a valid web address, such as example.com.";
    return;
  }

  const markdown = `[${text}](${url})`;
  t.setRangeText(markdown, linkSelectionStart, linkSelectionEnd, "end");
  closeLinkModal();
  t.focus();
};

$("#closeLinkButton").onclick = closeLinkModal;
$("[data-close-link]").onclick = closeLinkModal;

function closePreview() { $("#previewModal").classList.add("hidden"); document.body.style.overflow = ""; }
$("#previewButton").onclick = () => {
  const cover = $("#coverUrl").value;
  const categoryText = topics().map(esc).join(" · ") || "ESSAY";
  $("#previewArticle").innerHTML = `<header class="article-header"><p class="article-topics">${categoryText}</p><h1>${esc($("#title").value || "Untitled essay")}</h1>${$("#excerpt").value ? `<p class="article-deck">${esc($("#excerpt").value)}</p>` : ""}<p class="article-date">Preview · Paula Cezara Codrea</p></header>${cover ? `<img class="article-cover" src="${esc(cover)}" alt="">` : ""}<div class="article-content">${renderMarkdown($("#body").value)}</div>`;
  $("#previewModal").classList.remove("hidden"); document.body.style.overflow = "hidden";
};
$("#closePreviewButton").onclick = closePreview;
$("[data-close-preview]").onclick = closePreview;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#previewModal").classList.contains("hidden")) closePreview(); });

$("#cancelEditButton").onclick = reset;
$("#postForm").onsubmit = async (e) => {
  e.preventDefault();
  const r = await api(editingId ? "/api/posts/" + editingId : "/api/posts", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: $("#title").value, body: $("#body").value, excerpt: $("#excerpt").value, categories: $("#categories").value, status: $("#status").value, cover_image_url: $("#coverUrl").value || null }) });
  const d = await r.json();
  if (!r.ok) { $("#postMessage").textContent = d.error || "Could not save the post."; return; }
  reset(); $("#postMessage").textContent = "Saved!"; load();
};
$("#status").onchange = () => $("#submitPostButton").textContent = $("#status").value === "draft" ? "Save draft" : editingId ? "Save changes" : "Publish";
$("#logoutButton").onclick = async () => { await api("/api/logout", { method: "POST" }); location.href = "/"; };

(async () => {
  const r = await fetch("/api/me", { credentials: "same-origin" });
  const m = await r.json();
  if (!m.loggedIn) return location.href = "/login.html";
  csrfToken = m.csrfToken; $("#welcomeName").textContent = m.username; load();
})();
