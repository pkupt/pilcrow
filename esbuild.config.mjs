import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');
const watch = process.argv.includes('--watch');

const entries = {
  'background': resolve(src, 'background.ts'),
  'app': resolve(src, 'main.tsx'),
};

const staticAssets = [
  ['manifest.json', 'manifest.json'],
  ['index.html', 'index.html'],
];

const common = {
  bundle: true,
  format: 'iife',
  target: 'chrome109',
  sourcemap: false,
  logLevel: 'info',
  legalComments: 'none',
  loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
  jsx: 'automatic',
  jsxImportSource: 'preact',
  alias: { util: resolve(root, 'src/shims/util.ts') },
};

async function copyStatic() {
  if (existsSync(dist)) await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const [from, to] of staticAssets) {
    await cp(resolve(src, from), resolve(dist, to));
  }
}

async function main() {
  await copyStatic();
  if (watch) {
    const ctxs = await Promise.all(
      Object.entries(entries).map(([name, entry]) =>
        context({ ...common, entryPoints: [entry], outfile: resolve(dist, `${name}.js`) })
      )
    );
    await Promise.all(ctxs.map((c) => c.watch()));
    console.log('watching...');
  } else {
    await Promise.all(
      Object.entries(entries).map(([name, entry]) =>
        build({ ...common, entryPoints: [entry], outfile: resolve(dist, `${name}.js`) })
      )
    );
    console.log('build done');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
