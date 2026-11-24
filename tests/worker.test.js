import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import worker from '../worker.js';

const request = (path = '/', method = 'GET') => worker.fetch(new Request(`https://frostlink.example${path}`, { method }));

describe('单文件 Worker 交付', () => {
  test('根路径返回中文 HTML，正确内容类型，无外部脚本或样式请求', async () => {
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    const html = await response.text();
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /居家办公计算器/);
    assert.match(html, /理论达标 ≠ 实际无限释放/);
    assert.match(html, /游戏版本未核验/);
    assert.match(html, /5 秒施放间隔/);
    assert.doesNotMatch(html, /APP_STYLES|APP_SCRIPT/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel="stylesheet"/);
    assert.equal((html.match(/<script>/g) ?? []).length, 1);
    assert.equal((html.match(/<style>/g) ?? []).length, 1);
  });

  test('内嵌 JavaScript 语法有效，CSP 散列与最终内容完全匹配', async () => {
    const response = await request();
    const html = await response.text();
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.doesNotThrow(() => new Script(script));
    const csp = response.headers.get('content-security-policy');
    for (const content of [script, style]) {
      const hash = createHash('sha256').update(content).digest('base64');
      assert.ok(csp.includes(`'sha256-${hash}'`));
    }
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /style-src-attr 'unsafe-inline'/);
    assert.doesNotMatch(csp, /unsafe-eval/);
  });

  test('生成文件是无外部 import 的 ES Module，可单独上传', async () => {
    const source = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /^import\s/m);
    assert.match(source, /export\s*\{/);
    assert.equal(typeof worker.fetch, 'function');
    assert.equal(responseSize(source) < 200_000, true);
  });

  test('HEAD 只返回头部，不返回正文', async () => {
    const response = await request('/', 'HEAD');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  });

  test('POST 拒绝并指明允许方法，未知页面为 404，favicon 不报错', async () => {
    const post = await request('/', 'POST');
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
    assert.match(await post.text(), /仅支持/);
    assert.equal((await request('/unknown')).status, 404);
    assert.equal((await request('/favicon.ico')).status, 204);
  });

  test('Worker 设置内容安全和隐私响应头', async () => {
    const { headers } = await request();
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('referrer-policy'), 'no-referrer');
    assert.equal(headers.get('cache-control'), 'no-cache');
    assert.match(headers.get('permissions-policy'), /camera=\(\)/);
  });
});

function responseSize(source) { return Buffer.byteLength(source); }
