import { Marked, Renderer } from 'marked';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COPY_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

const renderer = new Renderer();

renderer.code = ({ text, lang }) => {
  const languageLabel = lang && lang.trim() ? escapeHtml(lang.trim().split(/\s+/)[0]) : 'code';
  const escapedCode = escapeHtml(text);

  return `<div class="chatgpt-code-block">
  <div class="chatgpt-code-header">
    <span class="chatgpt-code-lang">${languageLabel}</span>
    <span class="chatgpt-code-copy">${COPY_ICON_SVG}<span>Copy code</span></span>
  </div>
  <pre class="chatgpt-code-pre"><code>${escapedCode}</code></pre>
</div>`;
};

renderer.html = ({ text }) => {
  return escapeHtml(text);
};

const markedInstance = new Marked({
  renderer,
  gfm: true,
  breaks: true,
});

const STREAM_CURSOR_SENTINEL = '\uE000';

export function renderChatGptMarkdown(
  markdownText: string,
  showStreamCursor = false
): string {
  if (!markdownText.trim() && !showStreamCursor) {
    return '';
  }
  const source = showStreamCursor
    ? `${markdownText}${STREAM_CURSOR_SENTINEL}`
    : markdownText;
  const parsed = markedInstance.parse(source);
  const html = typeof parsed === 'string' ? parsed : '';
  if (!showStreamCursor) {
    return html;
  }
  return html.replace(
    STREAM_CURSOR_SENTINEL,
    '<span class="chatgpt-stream-dot" aria-hidden="true"></span>'
  );
}
