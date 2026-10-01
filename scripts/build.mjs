// Production build: bundles the React app with esbuild and writes a hashed, cache-friendly dist/.
// Usage: node scripts/build.mjs [--watch]

import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--watch');

async function writeHtml(result) {
  const outputs = Object.keys(result.metafile.outputs);
  const js = outputs.find((f) => f.endsWith('.js'));
  const css = outputs.find((f) => f.endsWith('.css'));
  const toUrl = (f) => `/${path.relative(dist, path.join(root, f)).split(path.sep).join('/')}`;
  const template = await readFile(path.join(root, 'index.html'), 'utf8');
  await writeFile(path.join(dist, 'index.html'), template.replace('%JS%', toUrl(js)).replace('%CSS%', toUrl(css)));
}

const options = {
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  outdir: path.join(dist, 'assets'),
  entryNames: watch ? 'app' : 'app.[hash]',
  format: 'esm',
  target: ['es2022', 'safari16', 'chrome110', 'firefox115'],
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  metafile: true,
  legalComments: 'none',
  external: ['/fonts/*'],
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  logLevel: 'info',
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'public'), dist, { recursive: true });

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{ name: 'html', setup: (b) => b.onEnd((r) => r.metafile && writeHtml(r)) }],
  });
  await ctx.watch();
} else {
  await writeHtml(await esbuild.build(options));
}
