// These markdown-it plugins ship without TypeScript declarations.
// Declaring them as `any` lets parser.ts register them via `parser.use(...)`.
declare module 'markdown-it-task-lists';
declare module 'markdown-it-wikilinks';
declare module 'markdown-it-footnote';
declare module 'markdown-it-deflist';
declare module 'markdown-it-container';