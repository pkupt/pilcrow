import { describe, it, expect } from 'vitest';
import { parse } from '../src/markdown/parser';

describe('parser', () => {
  it('renders headings', () => {
    expect(parse('# Hello')).toContain('<h1');
  });

  it('renders GFM tables', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
    expect(parse(md)).toContain('<table>');
  });

  it('renders task lists', () => {
    const md = '- [x] done\n- [ ] todo\n';
    const html = parse(md);
    expect(html).toContain('checkbox');
  });

  it('renders wikilinks', () => {
    expect(parse('[[Note A]]')).toContain('href');
    expect(parse('[[Note A]]')).toContain('Note A');
  });

  it('renders wikilinks with alias', () => {
    const html = parse('[[Note A|display text]]');
    expect(html).toContain('display text');
  });

  it('renders footnotes', () => {
    const md = 'Here[^1].\n\n[^1]: A note.\n';
    expect(parse(md)).toContain('footnote');
  });

  it('renders YAML front matter (stripped from body)', () => {
    const md = '---\ntitle: T\n---\n\n# Body';
    const html = parse(md);
    expect(html).toContain('<h1');
    expect(html).not.toContain('title: T');
  });

  it('renders callout containers', () => {
    const md = ':::note\nImportant.\n:::\n';
    expect(parse(md)).toContain('Important');
  });

  it('renders KaTeX math inline', () => {
    const html = parse('$a + b = c$');
    expect(html).toContain('katex');
  });

  it('renders KaTeX math block', () => {
    const html = parse('$$\na^2 + b^2 = c^2\n$$');
    expect(html).toContain('katex');
  });

  it('renders code blocks with highlighting classes', () => {
    const html = parse('```js\nconst x = 1;\n```');
    expect(html).toContain('code');
    expect(html).toContain('js');
  });

  it('renders anchors on headings (TOC)', () => {
    const html = parse('# Hello World');
    expect(html).toMatch(/id="hello-world"|id="hello"/);
  });

  it('renders strikethrough', () => {
    expect(parse('~~deleted~~')).toContain('del');
  });
});