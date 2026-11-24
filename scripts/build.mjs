import { readFile } from 'node:fs/promises';
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const [template, css, bundle] = await Promise.all([
  readFile(new URL('src/index.html', root), 'utf8'),
  readFile(new URL('src/styles.css', root), 'utf8'),
  build({
    absWorkingDir: root.pathname,
    entryPoints: ['src/ui.js'],
    bundle: true,
    write: false,
    format: 'iife',
    target: ['es2022'],
    minify: true,
    legalComments: 'inline',
  }),
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const style = (await transform(css, { loader: 'css', minify: true })).code;
const html = template.replace('/* APP_STYLES */', style).replace('/* APP_SCRIPT */', script);
const hash = (content) => `'sha256-${createHash('sha256').update(content).digest('base64')}'`;
const csp = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(style)}; style-src-attr 'unsafe-inline'; img-src 'self' data: https://ddragon.leagueoflegends.com https://raw.communitydragon.org; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
await build({
  absWorkingDir: root.pathname,
  stdin: {
    contents: `import { createWorker } from './src/worker.js';\nexport default createWorker(${JSON.stringify(html)}, ${JSON.stringify(csp)});`,
    resolveDir: root.pathname,
    sourcefile: 'worker-entry.js',
  },
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  outfile: new URL('worker.js', root).pathname,
  minify: false,
});
try {
  await import('node:fs/promises').then(fs => fs.writeFile(
    '/mnt/c/Users/98403/.gemini/antigravity/brain/2d9165d0-a4b8-4bb6-9096-f6c287c25a7a/full_deck_preview.html',
    html,
    'utf8'
  ));
} catch {}
console.log(`已构建 worker.js：${Buffer.byteLength(html).toLocaleString('en-US')} 字节 HTML，CSS / JS 全部内嵌，无运行时外部请求。`);
