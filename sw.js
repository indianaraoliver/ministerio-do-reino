/* Service Worker — atualização automática + offline
   Correção DEFINITIVA do erro do Safari "Response served by service worker has redirections":
   toda resposta é reconstruída SEM a marca de redirecionamento antes de ser guardada/entregue,
   e a navegação nunca depende de um endereço que o Cloudflare redireciona. */
const CACHE = 'ministerio-v1';
const CORE = [
  './',
  './styles.css',
  './app.js',
  './config.js',
  './cloud.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// Reconstrói a resposta sem a flag `redirected` (o que causa o erro no Safari)
async function noRedirect(res) {
  if (!res) return res;
  if (!res.redirected && res.type !== 'opaqueredirect') return res;
  const body = await res.arrayBuffer();
  return new Response(body, { status: res.status || 200, statusText: res.statusText || '', headers: res.headers });
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async a => {
      try { const r = await fetch(a, { redirect: 'follow' }); if (r && r.status === 200) await c.put(a, await noRedirect(r)); } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // NAVEGAÇÃO: rede primeiro, sempre reconstruída sem redirecionamento; offline cai no cache da raiz
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await noRedirect(await fetch(request, { redirect: 'follow' }));
        if (net && net.status === 200) { const c = await caches.open(CACHE); c.put('./', net.clone()); }
        return net;
      } catch (_) {
        return (await caches.match('./')) || (await caches.match(request)) ||
               new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  const isImg = /\.(png|svg|ico|webmanifest)$/i.test(new URL(request.url).pathname);
  e.respondWith((async () => {
    if (isImg) { const cached = await caches.match(request); if (cached) return cached; }
    try {
      const net = await noRedirect(await fetch(request));
      if (net && net.status === 200) { const c = await caches.open(CACHE); c.put(request, net.clone()); }
      return net;
    } catch (_) {
      return (await caches.match(request)) || Response.error();
    }
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
