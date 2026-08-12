import { describe, it, expect, vi } from 'vitest';
import { renderToHtml, renderMermaidBlocks } from '../src/markdown/render';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: '<svg class="mermaid-svg"></svg>' })),
  },
}));

describe('renderToHtml', () => {
  it('returns sanitized HTML for normal markdown', () => {
    const html = renderToHtml('# Hello\n\nworld');
    expect(html).toContain('<h1');
    expect(html).toContain('world');
  });

  it('strips <script> tags', () => {
    const md = '<script>alert(1)</script>\n\ntext';
    const html = renderToHtml(md);
    expect(html).not.toContain('<script');
  });

  it('strips on* event handlers', () => {
    const md = '<div onclick="alert(1)">x</div>';
    const html = renderToHtml(md);
    expect(html).not.toMatch(/<[a-zA-Z][^>]*\son\w+=/i);
  });

  it('strips javascript: links', () => {
    const md = '[bad](javascript:alert(1))';
    const html = renderToHtml(md);
    expect(html).not.toMatch(/href=['"]?javascript:/i);
  });

  it('preserves wikilink hrefs', () => {
    const html = renderToHtml('[[Note A]]');
    expect(html).toContain('href');
  });

  it('preserves mermaid code blocks as pre.mermaid', () => {
    const html = renderToHtml('```mermaid\ngraph TD; A-->B\n```');
    expect(html).toContain('mermaid');
  });

  it('keeps inline style attributes for KaTeX positioning', () => {
    const html = renderToHtml('$x^2 + \\frac{1}{2}$');
    expect(html).toMatch(/style=/);
  });

  it('still sanitizes dangerous styles from allowed style attr', () => {
    const md = '[x](http://example.com){style="background:url(javascript:alert(1));color:red"}';
    const html = renderToHtml(md);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toMatch(/color:\s*red/i);
  });
});

describe('renderMermaidBlocks', () => {
  it('renders mermaid blocks into svg', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToHtml('```mermaid\ngraph TD; A-->B\n```');
    await renderMermaidBlocks(container);
    // Mermaid should have replaced the code block with an svg or error
    expect(container.innerHTML).not.toContain('graph TD');
  });

  it('leaves non-mermaid code blocks untouched', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToHtml('```js\nconst x = 1;\n```');
    const before = container.innerHTML;
    await renderMermaidBlocks(container);
    expect(container.innerHTML).toBe(before);
  });
});