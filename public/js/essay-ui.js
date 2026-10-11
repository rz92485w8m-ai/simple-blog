/* Presentation helpers only; API routes and stored content remain unchanged. */
window.EssayUI = (() => {
  const escape = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  const plainText = (value) =>
    String(value || "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/[*_`>#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const excerpt = (post) => {
    if (post.excerpt?.trim()) return post.excerpt.trim();
    const text = plainText(post.body);
    return text.length > 190 ? text.slice(0, 190).trimEnd() + "…" : text;
  };
  const topics = (post) => [
    ...new Set(
      String(post.categories || "")
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
    ),
  ];
  const date = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? ""
      : parsed.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
  };
  const dateMarkup = (value) => {
    const label = date(value);
    return label
      ? `<time datetime="${escape(new Date(value).toISOString())}">${label}</time>`
      : "";
  };
  // Existing author-uploaded covers always take precedence. Fallback artwork is
  // editorial decoration only and never changes post data or storage.
  const artwork = (post) => {
    if (post.cover_image_url)
      return { src: post.cover_image_url, className: "thumb-uploaded" };
    const categoryText = topics(post).join(" ").toLowerCase();
    if (/artificial|intelligence|technology|machine|\bai\b/.test(categoryText))
      return {
        src: "/images/human-ai-symbiosis.webp",
        className: "thumb-symbiosis",
      };
    if (/life|reflection|human condition/.test(categoryText))
      return {
        src: "/images/mediterranean-hero.webp",
        className: "thumb-statue",
      };
    if (/consciousness|identity|psychology|awareness/.test(categoryText))
      return {
        src: "/images/mediterranean-hero.webp",
        className: "thumb-portrait",
      };
    return {
      src: "/images/philosophy-terrace.webp",
      className: "thumb-terrace",
    };
  };
  const artworkMarkup = (post, className = "article-illustration") => {
    const image = artwork(post);
    return `<figure class="${className}"><img src="${escape(image.src)}" alt="" width="${image.className === "thumb-terrace" ? 1536 : 2172}" height="${image.className === "thumb-terrace" ? 1024 : 724}" loading="lazy"><figcaption>Editorial artwork · ${/thumb-symbiosis/.test(image.className) ? "human and artificial intelligence in dialogue" : "a classical Mediterranean setting"}</figcaption></figure>`;
  };
  const card = (post, index = 0) => {
    const href = "/p/" + encodeURIComponent(post.slug);
    const image = artwork(post);
    return `<article class="essay-card"><a class="essay-thumb ${image.className}" href="${href}" tabindex="-1" aria-hidden="true"><img src="${escape(image.src)}" alt="" width="${image.className === "thumb-terrace" ? 1536 : 2172}" height="${image.className === "thumb-terrace" ? 1024 : 724}" loading="lazy" decoding="async"></a><div class="essay-card-copy"><div class="essay-topics"><span class="essay-number" aria-hidden="true">${String(index + 1).padStart(2, "0")} /</span> ${topics(post).map(escape).join(" · ") || "Essay"}</div><h3><a class="essay-title" href="${href}">${escape(post.title)}</a></h3><p>${escape(excerpt(post))}</p><div class="essay-card-footer">${dateMarkup(post.created_at)}<a class="read-arrow" href="${href}" aria-label="Read ${escape(post.title)}"><span aria-hidden="true">→</span></a></div></div></article>`;
  };
  async function request(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const error = new Error("Content could not be loaded.");
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  function errorState(box, retry, message = "Please try again in a moment.") {
    box.innerHTML = `<div class="error-state" role="alert"><h2>Unable to load the writing</h2><p>${escape(message)}</p><button class="retry-button" type="button">Try again</button></div>`;
    box.querySelector("button").addEventListener("click", retry);
    box.setAttribute("aria-busy", "false");
  }
  function loading(box, message) {
    box.setAttribute("aria-busy", "true");
    box.innerHTML = `<p class="loading-card" role="status">${escape(message)}</p>`;
  }
  return {
    escape,
    plainText,
    excerpt,
    topics,
    date,
    dateMarkup,
    card,
    artwork,
    artworkMarkup,
    request,
    errorState,
    loading,
  };
})();
