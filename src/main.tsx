import { render } from 'preact';
import { App } from './ui/App';
import { initWorkspace } from './store/workspace';
import { initHooks } from './ui/initHooks';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

initHooks();
initWorkspace();

render(<App />, document.getElementById('app')!);