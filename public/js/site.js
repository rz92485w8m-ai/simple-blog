window.BLOG_CONFIG = {
  name: "Simple Blog",
  tagline: "Stories, ideas and things worth sharing.",
  description: "A personal blog for stories, ideas and things worth sharing.",
  author: "Author",
  footer: "Simple Blog"
};

function applyBlogBranding() {
  const c = window.BLOG_CONFIG;
  document.querySelectorAll("[data-blog-name]").forEach(el => el.textContent = c.name);
  document.querySelectorAll("[data-blog-tagline]").forEach(el => el.textContent = c.tagline);
  document.querySelectorAll("[data-blog-author]").forEach(el => el.textContent = c.author);
  document.querySelectorAll("[data-blog-footer]").forEach(el => el.textContent = c.footer);
}
document.addEventListener("DOMContentLoaded", applyBlogBranding);
