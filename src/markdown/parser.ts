import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import wikilinksPlugin from 'markdown-it-wikilinks';
import footnote from 'markdown-it-footnote';
import deflist from 'markdown-it-deflist';
import attrs from 'markdown-it-attrs';
import frontMatter from 'markdown-it-front-matter';
import anchor from 'markdown-it-anchor';
import container from 'markdown-it-container';
import katexPlugin from '@traptitech/markdown-it-katex';
import hljs from 'highlight.js';

export const parser: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const out = hljs.highlight(str, { language: lang }).value;
        return `<pre class="hljs language-${lang}"><code>${out}</code></pre>`;
      } catch {
        // fall through
      }
    }
    return `<pre class="hljs"><code${lang ? ` class="language-${lang}"` : ''}>${parser.utils.escapeHtml(str)}</code></pre>`;
  },
});

parser.use(taskLists);
parser.use(wikilinksPlugin({ baseURL: '/', relativeBaseURL: '/', makeAllLinksAbsolute: true }));
parser.use(footnote);
parser.use(deflist);
parser.use(attrs);
parser.use(frontMatter, () => {
  // front matter is parsed and discarded from body
});
parser.use(anchor, {
  permalink: false,
  slugify: (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fff-]/g, '')
      .replace(/-+/g, '-'),
});
parser.use(container, 'note', {
  render(tokens: { info: string; nesting: number }[], idx: number) {
    if (tokens[idx].nesting === 1) {
      return '<div class="callout note">\n';
    }
    return '</div>\n';
  },
});
parser.use(container, 'warning', {
  render(tokens: { info: string; nesting: number }[], idx: number) {
    if (tokens[idx].nesting === 1) {
      return '<div class="callout warning">\n';
    }
    return '</div>\n';
  },
});
parser.use(katexPlugin);

export function parse(markdown: string): string {
  return parser.render(markdown);
}