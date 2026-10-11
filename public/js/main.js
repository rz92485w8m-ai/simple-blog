(() => {
  const box = document.querySelector("#posts");
  const ui = window.EssayUI;
  async function load() {
    ui.loading(box, "Loading essays…");
    try {
      const posts = await ui.request("/api/posts");
      if (!Array.isArray(posts)) throw new Error("Unexpected response");
      box.innerHTML = posts.length
        ? posts.slice(0, 3).map(ui.card).join("")
        : '<p class="empty-editorial" role="status">New essays are coming soon.</p>';
      box.setAttribute("aria-busy", "false");
    } catch {
      ui.errorState(box, load);
    }
  }
  load();
})();
