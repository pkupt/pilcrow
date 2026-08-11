import { render } from 'preact';
import { App } from './ui/App';
import { initHooks } from './ui/initHooks';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

initHooks();

render(<App />, document.getElementById('app')!);