const form = document.querySelector("#loginForm");
const error = document.querySelector("#loginError");

async function csrfToken() {
  const response = await fetch("/api/csrf", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Could not initialise a secure login.");
  return (await response.json()).csrfToken;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const token = await csrfToken();
    const response = await fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
      body: JSON.stringify({ username: form.username.value.trim(), password: form.password.value })
    });
    const data = await response.json();
    if (!response.ok) {
      error.textContent = data.error || "Login failed.";
      return;
    }
    location.href = "/admin.html";
  } catch (err) {
    error.textContent = "Login could not be completed. Please refresh and try again.";
  } finally {
    submit.disabled = false;
  }
});
