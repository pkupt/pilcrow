import DOMPurify from 'dompurify';
import { parse } from './parser';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'strong', 'em', 'del', 's', 'mark', 'sub', 'sup',
  'a', 'code', 'pre', 'span',
  'ul', 'ol', 'li',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
  'div', 'section', 'article',
  'input',
  'dl', 'dt', 'dd',
  'figure', 'figcaption',
  'svg', 'path', 'g', 'rect', 'circle', 'line', 'text', 'polyline', 'polygon',
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mroot', 'mtable', 'mtr', 'mtd',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'colspan', 'rowspan', 'type', 'checked', 'disabled',
  'target', 'rel',
  'data-*',
  // KaTeX (and some plugins) position their internals via inline styles
  // (strut heights, fraction lines, sqrt, mspace). DOMPurify sanitizes the
  // style value itself, so allowing the attribute is safe.
  'style',
  'viewBox', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform',
  'xmlns', 'encoding',
];

export function renderToHtml(markdown: string): string {
  installStyleSanitizer();
  const raw = parse(markdown);
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });
}

// DOMPurify keeps harmless positional styles (KaTeX) but does not strip
// javascript: URLs embedded in CSS url() values. Explicitly drop them.
const DANGEROUS_URL_RE = /(url\(\s*['"]?(?:javascript|data:text\/html|vbscript)\s*:|expression\(|@import\s)/i;
const ALLOWED_URL_RE = /^(https?:|mailto:|data:image\/|#|\/|\.)/i;
let hookInstalled = false;

function installStyleSanitizer(): void {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName !== 'A' && node.nodeName !== 'DIV' && node.nodeName !== 'SPAN') return;
    const style = node.getAttribute('style');
    if (!style) return;
    const cleaned = style
      .split(';')
      .map((decl) => decl.trim())
      .filter((decl) => {
        if (!decl) return true;
        if (DANGEROUS_URL_RE.test(decl)) return false;
        const urlMatch = decl.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
        if (urlMatch && !ALLOWED_URL_RE.test(urlMatch[1])) return false;
        return true;
      })
      .join(';');
    node.setAttribute('style', cleaned);
  });
}

let mermaidPromise: Promise<typeof import('mermaid')['default']> | null = null;

async function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mermaid = m.default;
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export async function renderMermaidBlocks(container: HTMLElement): Promise<void> {
  const blocks = container.querySelectorAll('pre code.language-mermaid, pre.mermaid, code.language-mermaid');
  if (blocks.length === 0) return;
  const mermaid = await loadMermaid();
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as HTMLElement;
    const code = block.textContent ?? '';
    const id = `mermaid-svg-${i}`;
    try {
      const { svg } = await mermaid.render(id, code);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-rendered';
      wrapper.innerHTML = svg;
      const parent = block.closest('pre') ?? block;
      parent.replaceWith(wrapper);
    } catch (err) {
      const errDiv = document.createElement('div');
      errDiv.className = 'mermaid-error';
      errDiv.textContent = `Mermaid render failed: ${(err as Error).message}`;
      const parent = block.closest('pre') ?? block;
      parent.replaceWith(errDiv);
    }
  }
}