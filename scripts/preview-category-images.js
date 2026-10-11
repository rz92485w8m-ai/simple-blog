/* Served and injected only by the read-only preview server. */
(() => {
  const ui = window.EssayUI;
  const originalCard = ui.card;
  ui.card = (post, index = 0) => {
    const markup = originalCard(post, index);
    // Author-selected covers always win, including in preview fixtures.
    if (post.cover_image_url || !post.preview_image_url) return markup;
    const topic = document.querySelector('#topicFilters button[aria-pressed="true"]')?.dataset.topic;
    const src = post.preview_category_images?.[topic] || post.preview_image_url;
    const template = document.createElement("template");
    template.innerHTML = markup;
    const thumb = template.content.querySelector(".essay-thumb");
    const image = thumb.querySelector("img");
    const ai = src === "/images/human-ai-symbiosis.webp";
    thumb.className = "essay-thumb " + (ai ? "thumb-symbiosis" : "thumb-category");
    image.setAttribute("src", src);
    image.setAttribute("width", ai ? "2172" : "1672");
    image.setAttribute("height", ai ? "724" : "941");
    return template.innerHTML;
  };
})();
