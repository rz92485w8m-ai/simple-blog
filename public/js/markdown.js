(function () {
  function esc(s) { return String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function inline(s) {
    let x = esc(s);
    x = x.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    x = x.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    x = x.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    x = x.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    return x;
  }
  function render(md) {
    const lines = String(md ?? '').replace(/\r\n?/g,'\n').split('\n');
    let out = [], para = [], inList = false;
    const flush = () => { if (para.length) { out.push('<p>'+para.map(inline).join('<br>')+'</p>'); para=[]; } };
    const closeList = () => { if (inList) { out.push('</ul>'); inList=false; } };
    for (const line of lines) {
      const h = line.match(/^(#{1,3})\s+(.+)$/);
      const li = line.match(/^\s*[-*]\s+(.+)$/);
      if (h) { flush(); closeList(); const n=h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
      else if (li) { flush(); if (!inList) { out.push('<ul>'); inList=true; } out.push(`<li>${inline(li[1])}</li>`); }
      else if (!line.trim()) { flush(); closeList(); }
      else { closeList(); para.push(line); }
    }
    flush(); closeList(); return out.join('\n');
  }
  window.BlogMarkdown = { render, escapeHtml: esc };
})();
