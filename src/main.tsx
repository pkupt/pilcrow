import { render } from 'preact';
import { App } from './ui/App';
import { initHooks } from './ui/initHooks';

initHooks();

render(<App />, document.getElementById('app')!);