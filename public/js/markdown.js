function escapeMarkdownHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMarkdown(markdown) {
  const lines = escapeMarkdownHtml(markdown || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  let html = "";
  let inList = false;

  function inline(text) {
    return text
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  }

  function closeList() {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  }

  for (const line of lines) {
    const text = line.trim();

    if (!text) {
      closeList();
      continue;
    }

    const listItem = text.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(listItem[1])}</li>`;
      continue;
    }

    closeList();

    const heading = text.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html += `<h${level}>${inline(heading[2])}</h${level}>`;
      continue;
    }

    html += `<p>${inline(text)}</p>`;
  }

  closeList();
  return html;
}
