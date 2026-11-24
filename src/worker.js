export function createWorker(html, csp) {
  return {
    async fetch(request, env, ctx) {
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': csp,
        'Cache-Control': 'no-cache',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      };
      if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response('仅支持 GET 和 HEAD 请求', {
          status: 405,
          headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' },
        });
      }
      const path = new URL(request.url).pathname;
      if (path === '/favicon.ico') return new Response(null, { status: 204 });
      if (path !== '/') {
        return new Response('页面不存在', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      return new Response(request.method === 'HEAD' ? null : html, { headers });
    },
  };
}
