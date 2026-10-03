let editingId = null;
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
const date = (v) => new Date(v).toLocaleDateString();
async function load() {
  const r = await fetch("/api/admin/posts"),
    ps = await r.json();
  $("#adminPosts").innerHTML =
    ps
      .map(
        (p) =>
          `<article class="post-card">${p.cover_image_url ? `<img class="card-cover" src="${esc(p.cover_image_url)}">` : ""}<div class="post-actions"><span>${date(p.updated_at)} · <b>${p.status}</b></span><div class="action-buttons">${p.status === "published" ? `<a href="/p/${p.slug}">View</a>` : ""}<button class="edit-button" data-id="${p.id}">Edit</button><button class="delete-button" data-id="${p.id}">Delete</button></div></div><h3>${esc(p.title)}</h3></article>`,
      )
      .join("") || '<div class="empty">No posts yet.</div>';
  document.querySelectorAll(".edit-button").forEach(
    (b) =>
      (b.onclick = async () => {
        const r = await fetch("/api/posts/" + b.dataset.id),
          p = await r.json();
        editingId = p.id;
        $("#title").value = p.title;
        $("#body").value = p.body;
        $("#status").value = p.status;
        $("#coverUrl").value = p.cover_image_url || "";
        showCover(p.cover_image_url);
        $("#submitPostButton").textContent = "Save changes";
        $("#cancelEditButton").classList.remove("hidden");
        scrollTo(0, 0);
      }),
  );
  document.querySelectorAll(".delete-button").forEach(
    (b) =>
      (b.onclick = async () => {
        if (confirm("Delete this post?")) {
          await fetch("/api/posts/" + b.dataset.id, { method: "DELETE" });
          load();
        }
      }),
  );
}
function showCover(u) {
  if (u) {
    $("#coverPreview").src = u;
    $("#coverPreview").classList.remove("hidden");
  } else $("#coverPreview").classList.add("hidden");
}
function reset() {
  editingId = null;
  $("#postForm").reset();
  $("#coverUrl").value = "";
  showCover();
  $("#cancelEditButton").classList.add("hidden");
  $("#submitPostButton").textContent = "Publish";
}
$("#coverImage").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  $("#uploadStatus").textContent = "Uploading…";
  const fd = new FormData();
  fd.append("image", f);
  const r = await fetch("/api/upload", { method: "POST", body: fd }),
    d = await r.json();
  $("#uploadStatus").textContent = r.ok ? "Uploaded" : d.error;
  if (r.ok) {
    $("#coverUrl").value = d.url;
    showCover(d.url);
  }
};
document.querySelectorAll(".editor-toolbar button").forEach(
  (b) =>
    (b.onclick = () => {
      const t = $("#body"),
        a = t.selectionStart,
        z = t.selectionEnd,
        x = t.value.slice(a, z);
      t.setRangeText(
        b.dataset.wrap
          ? b.dataset.wrap + x + b.dataset.wrap
          : b.dataset.prefix + x,
        a,
        z,
        "select",
      );
      t.focus();
    }),
);
$("#previewButton").onclick = () => {
  const w = open("", "_blank"),
    cover = $("#coverUrl").value;
  w.document.write(
    `<style>body{font:18px system-ui;max-width:760px;margin:60px auto;line-height:1.8}img{width:100%}</style>${cover ? `<img src="${esc(cover)}">` : ""}<h1>${esc($("#title").value)}</h1><div>${renderMarkdown($("#body").value)}</div>`,
  );
};
$("#cancelEditButton").onclick = reset;
$("#postForm").onsubmit = async (e) => {
  e.preventDefault();
  const r = await fetch(editingId ? "/api/posts/" + editingId : "/api/posts", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: $("#title").value,
        body: $("#body").value,
        status: $("#status").value,
        cover_image_url: $("#coverUrl").value || null,
      }),
    }),
    d = await r.json();
  if (!r.ok) {
    $("#postMessage").textContent = d.error;
    return;
  }
  reset();
  $("#postMessage").textContent = "Saved!";
  load();
};
$("#status").onchange = () =>
  ($("#submitPostButton").textContent =
    $("#status").value === "draft"
      ? "Save draft"
      : editingId
        ? "Save changes"
        : "Publish");
$("#logoutButton").onclick = async () => {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/";
};
(async () => {
  const r = await fetch("/api/me"),
    m = await r.json();
  if (!m.loggedIn) return (location.href = "/login.html");
  $("#welcomeName").textContent = m.username;
  load();
})();
