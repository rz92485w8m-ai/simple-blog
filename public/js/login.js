const form = document.querySelector("#loginForm");
const error = document.querySelector("#loginError");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";

  const username = form.username.value.trim();
  const password = form.password.value;

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();

  if (!response.ok) {
    error.textContent = data.error || "Login failed.";
    return;
  }

  location.href = "/admin.html";
});
