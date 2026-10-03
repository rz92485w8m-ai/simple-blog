let editingId = null;
async function requireSession() {
  const response = await fetch("/api/me"); const me = await response.json();
  if (!me.loggedIn) { location.href = "/login.html"; return null; }
  document.querySelector("#welcomeName").textContent = me.username;
  document.querySelector(".avatar").textContent = me.username[0].toUpperCase(); return me;
}
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function formatDate(value) { return new Date(value).toLocaleDateString(undefined, {year:"numeric",month:"long",day:"numeric"}); }
async function loadAdminPosts() {
  const response = await fetch("/api/posts"); const posts = await response.json(); const container = document.querySelector("#adminPosts");
  container.innerHTML = posts.map(post => `<article class="post-card"><div class="post-actions"><span class="post-date">${formatDate(post.created_at)}</span><div class="action-buttons"><a href="/post.html?id=${post.id}">View</a><button class="edit-button" data-id="${post.id}">Edit</button><button class="delete-button" data-id="${post.id}">Delete</button></div></div><h3>${escapeHtml(post.title)}</h3><div class="post-body">${escapeHtml(post.body).replaceAll("\n", "<br>")}</div></article>`).join("") || '<div class="empty">No posts yet.</div>';
  container.querySelectorAll(".edit-button").forEach(button => button.addEventListener("click", async () => {
    const r = await fetch(`/api/posts/${button.dataset.id}`); const post = await r.json(); editingId = post.id;
    const form = document.querySelector("#postForm"); form.title.value = post.title; form.body.value = post.body;
    document.querySelector("#submitPostButton").textContent = "Save changes"; document.querySelector("#cancelEditButton").classList.remove("hidden"); form.scrollIntoView({behavior:"smooth"});
  }));
  container.querySelectorAll(".delete-button").forEach(button => button.addEventListener("click", async () => { if (!confirm("Delete this post?")) return; const r=await fetch(`/api/posts/${button.dataset.id}`,{method:"DELETE"}); if(r.ok) loadAdminPosts(); }));
}
function cancelEdit() { editingId=null; document.querySelector("#postForm").reset(); document.querySelector("#submitPostButton").textContent="Post"; document.querySelector("#cancelEditButton").classList.add("hidden"); document.querySelector("#postMessage").textContent=""; }
document.querySelector("#cancelEditButton").addEventListener("click", cancelEdit);
document.querySelector("#postForm").addEventListener("submit", async event => {
  event.preventDefault(); const form=event.currentTarget; const message=document.querySelector("#postMessage"); message.textContent="";
  const url=editingId ? `/api/posts/${editingId}` : "/api/posts"; const method=editingId ? "PUT" : "POST";
  const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({title:form.title.value,body:form.body.value})}); const data=await response.json();
  if(!response.ok){message.textContent=data.error||"Could not save.";message.className="message error";return;}
  const wasEditing=Boolean(editingId); cancelEdit(); message.textContent=wasEditing?"Changes saved!":"Published!"; message.className="message success"; loadAdminPosts();
});
document.querySelector("#logoutButton").addEventListener("click",async()=>{await fetch("/api/logout",{method:"POST"});location.href="/";});
(async()=>{const me=await requireSession();if(me)loadAdminPosts();})();
