(() => {
  const ui = window.EssayUI;
  const box = document.querySelector("#singlePost");
  function metadata(post) {
    const description = (post.excerpt || ui.plainText(post.body)).slice(0, 160);
    document.title = `${post.title} — Beyond the Persona`;
    document.querySelector('meta[name="description"]').content = description;
    const set = (property, value) => {
      let element = document.querySelector(`meta[property="${property}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute("property", property);
        document.head.appendChild(element);
      }
      element.content = value;
    };
    set("og:title", post.title);
    set("og:description", description);
    set("og:type", "article");
    set("og:url", location.href);
    if (post.cover_image_url) set("og:image", post.cover_image_url);
  }
  function notFound() {
    document.title = "Essay not found — Beyond the Persona";
    box.innerHTML =
      '<header class="article-header"><p class="kicker">The journal</p><h1>Essay not found.</h1><p>This essay may have moved or is not available.</p><a class="text-link" href="/essays.html">Back to essays <span aria-hidden="true">→</span></a></header>';
    box.setAttribute("aria-busy", "false");
  }
  async function load() {
    ui.loading(box, "Loading essay…");
    const match = location.pathname.match(/^\/p\/([^/]+)\/?$/);
    if (!match) return notFound();
    let slug;
    try {
      slug = decodeURIComponent(match[1]);
    } catch {
      return notFound();
    }
    try {
      const post = await ui.request(
        `/api/posts/slug/${encodeURIComponent(slug)}`,
      );
      if (
        !post ||
        typeof post.title !== "string" ||
        typeof post.body !== "string"
      )
        throw new Error("Unexpected response");
      metadata(post);
      box.innerHTML = `<header class="article-header"><p class="article-topics">${ui.topics(post).map(ui.escape).join(" · ") || "Essay"}</p><h1>${ui.escape(post.title)}</h1>${post.excerpt ? `<p class="article-deck">${ui.escape(post.excerpt)}</p>` : ""}<p class="article-date">Paula Cezara Codrea · ${ui.dateMarkup(post.created_at)}</p></header>${post.cover_image_url ? `<img class="article-cover" src="${ui.escape(post.cover_image_url)}" alt="">` : ""}<div class="article-content">${renderMarkdown(post.body)}</div><div class="article-end"><a href="/essays.html">← All essays</a></div>`;
      box.setAttribute("aria-busy", "false");
    } catch (error) {
      if (error.status === 404) return notFound();
      ui.errorState(
        box,
        load,
        "The essay could not be loaded. Please try again.",
      );
    }
  }
  load();
})();
