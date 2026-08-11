import { useRef } from 'preact/hooks';
import { useSignal, useSignalEffect } from '@preact/signals';
import { workspace } from '../store/workspace';
import { renderToHtml, renderMermaidBlocks } from '../markdown/render';
import { resolveWikilink } from '../markdown/wikilinks';

const MAX_PREVIEW_BYTES = 1_000_000;
let renderTimer: ReturnType<typeof setTimeout> | null = null;

export function PreviewPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useSignal<string>('');

  useSignalEffect(() => {
    if (renderTimer) clearTimeout(renderTimer);
    const content = workspace.openFileContent.value;
    if (content === null) {
      html.value = '';
      return;
    }
    if (content.length > MAX_PREVIEW_BYTES) {
      html.value = '<div class="preview-too-large">File too large, preview disabled.</div>';
      return;
    }
    renderTimer = setTimeout(() => {
      html.value = renderToHtml(content);
    }, 250);
  });

  useSignalEffect(() => {
    const el = containerRef.current;
    if (!el || !html.value) return;
    el.innerHTML = html.value;
    void renderMermaidBlocks(el);
  });

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;
    e.preventDefault();
    const href = anchor.getAttribute('href') ?? '';
    // Wikilinks render as /Note_A.html (spaces slugified to _)
    const wikilinkMatch = href.match(/^\/(.+)$/);
    if (wikilinkMatch) {
      const decoded = decodeURIComponent(wikilinkMatch[1]).replace(/\.html$/, '');
      const decodedName = decoded.replace(/[_+]/g, ' ');
      let resolved = resolveWikilink(decodedName, workspace.tree.value);
      if (!resolved) {
        const rawName = wikilinkMatch[1].replace(/\.html$/, '').replace(/[_+]/g, ' ');
        resolved = resolveWikilink(rawName, workspace.tree.value);
      }
      if (resolved) {
        void workspace.openFile(resolved);
        return;
      }
    }
    // Relative .md links
    if (href.endsWith('.md')) {
      void workspace.openFile(href);
      return;
    }
    // External link - open in new tab
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener');
    }
  };

  if (workspace.openFileContent.value === null) {
    return <div class="preview-pane-content empty"><p>no preview</p></div>;
  }

  return (
    <div
      class="preview-pane-content"
      ref={containerRef}
      onClick={handleClick}
    />
  );
}
