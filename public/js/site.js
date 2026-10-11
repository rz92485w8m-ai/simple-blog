window.BLOG_CONFIG = {
  name: "Beyond the Persona",
  author: "Paula Cezara Codrea",
  tagline: "What makes us human?",
  description:
    "Essays on consciousness, psychology, philosophy, human identity and artificial intelligence.",
  linkedin: "",
  email: "",
};

document.addEventListener("DOMContentLoaded", () => {
  const c = window.BLOG_CONFIG;
  document
    .querySelectorAll("[data-blog-name]")
    .forEach((el) => (el.textContent = c.name));
  document
    .querySelectorAll("[data-blog-author]")
    .forEach((el) => (el.textContent = c.author));
  document
    .querySelectorAll("[data-blog-tagline]")
    .forEach((el) => (el.textContent = c.tagline));
  document
    .querySelectorAll("[data-blog-description]")
    .forEach((el) => (el.textContent = c.description));
  document.querySelectorAll("[data-linkedin]").forEach((el) => {
    el.hidden = !c.linkedin;
    if (c.linkedin) el.href = c.linkedin;
  });
  document.querySelectorAll("[data-email]").forEach((el) => {
    if (c.email) {
      el.href = `mailto:${c.email}`;
      el.hidden = false;
      if (el.classList.contains("contact-address")) el.textContent = c.email;
    } else {
      el.hidden = true;
    }
  });
  document.querySelectorAll("[data-email-placeholder]").forEach((el) => {
    el.hidden = Boolean(c.email);
  });
  document.querySelectorAll("[data-linkedin-placeholder]").forEach((el) => {
    el.hidden = Boolean(c.linkedin);
  });
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
});
