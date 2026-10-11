(() => {
  const ui = window.EssayUI;
  const box = document.querySelector("#essays");
  const filters = document.querySelector("#topicFilters");
  const status = document.querySelector("#resultsStatus");
  let posts = [];
  function draw(topic = "") {
    const selected = posts.filter(
      (post) => !topic || ui.topics(post).includes(topic),
    );
    box.innerHTML =
      selected.map(ui.card).join("") ||
      '<p class="empty-editorial">No essays in this topic yet.</p>';
    box.setAttribute("aria-busy", "false");
    status.textContent = `${selected.length} ${selected.length === 1 ? "essay" : "essays"}${topic ? " · " + topic : ""}`;
  }
  filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-topic]");
    if (!button) return;
    filters
      .querySelectorAll("button")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
    draw(button.dataset.topic);
  });
  async function load() {
    ui.loading(box, "Loading essays…");
    filters.replaceChildren();
    status.textContent = "";
    try {
      posts = await ui.request("/api/posts");
      if (!Array.isArray(posts)) throw new Error("Unexpected response");
      const allTopics = [...new Set(posts.flatMap(ui.topics))].sort();
      filters.innerHTML =
        '<button type="button" aria-pressed="true" data-topic="">All</button>' +
        allTopics
          .map(
            (topic) =>
              `<button type="button" aria-pressed="false" data-topic="${ui.escape(topic)}">${ui.escape(topic)}</button>`,
          )
          .join("");
      const requested = new URLSearchParams(location.search).get("topic");
      const selected =
        requested &&
        (allTopics.find(
          (topic) => topic.toLowerCase() === requested.toLowerCase(),
        ) ||
          (requested === "Artificial Intelligence" &&
            allTopics.find((topic) =>
              /^(AI|Artificial Intelligence|Technology)$/i.test(topic),
            )));
      if (selected)
        filters
          .querySelectorAll("button")
          .forEach((button) =>
            button.setAttribute(
              "aria-pressed",
              String(button.dataset.topic === selected),
            ),
          );
      draw(selected || "");
    } catch {
      ui.errorState(box, load);
    }
  }
  load();
})();
