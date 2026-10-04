window.BLOG_CONFIG = {
  name: "Beyond the Persona",
  author: "Paula Cezara Codrea",
  tagline: "Where consciousness meets the machine.",
  description: "Reflections on awareness, identity, work, technology and the human experience.",
  linkedin: "",
  email: ""
};

document.addEventListener("DOMContentLoaded", () => {
  const c = window.BLOG_CONFIG;
  document.querySelectorAll("[data-blog-name]").forEach(el => el.textContent = c.name);
  document.querySelectorAll("[data-blog-author]").forEach(el => el.textContent = c.author);
  document.querySelectorAll("[data-blog-tagline]").forEach(el => el.textContent = c.tagline);
  document.querySelectorAll("[data-blog-description]").forEach(el => el.textContent = c.description);
  document.querySelectorAll("[data-linkedin]").forEach(el => { if(c.linkedin){el.href=c.linkedin}else{el.hidden=true} });
  document.querySelectorAll("[data-email]").forEach(el => { if(c.email){el.href=`mailto:${c.email}`}else{el.hidden=true} });
});
