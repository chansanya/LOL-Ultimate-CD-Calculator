import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const distDir = new URL('dist/', root);
const publicDir = new URL('public/', root);

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

// 1. 构建 Cloudflare Pages 静态产物目录 (dist/)
await mkdir(distDir, { recursive: true });
await writeFile(new URL('index.html', distDir), html, 'utf8');

// Pages 安全响应头 (_headers)
const headersContent = `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: interest-cohort=()
  Cache-Control: public, max-age=0, must-revalidate
`;
await writeFile(new URL('_headers', distDir), headersContent, 'utf8');

// 将公共静态资源目录 public/ 复制到 dist/
if (existsSync(publicDir.pathname)) {
  await cp(publicDir.pathname, distDir.pathname, { recursive: true });
}

// 2. 同时生成单文件 worker.js，保持对 Cloudflare Workers 部署的完全兼容
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

// 本地预览文件同步
try {
  await writeFile(
    '/mnt/c/Users/98403/.gemini/antigravity/brain/2d9165d0-a4b8-4bb6-9096-f6c287c25a7a/full_deck_preview.html',
    html,
    'utf8'
  );
} catch {}

console.log(`已完成构建：生成 dist/（Cloudflare Pages 静态目录，含 index.html 与 _headers）与 worker.js（${Buffer.byteLength(html).toLocaleString('en-US')} 字节，CSS/JS 全部内嵌，无外部依赖）。`);
