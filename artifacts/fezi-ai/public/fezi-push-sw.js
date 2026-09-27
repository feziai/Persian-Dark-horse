/* Dedicated background push worker. No permission requests or automatic subscriptions. */
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data;
    try {
      data = event.data ? event.data.json() : null;
    } catch {
      data = null;
    }
    if (!data || typeof data !== 'object') return;
    const title = typeof data.title === 'string' ? data.title.slice(0, 100) : 'Persian Dark Horse';
    const body = typeof data.body === 'string' ? data.body.slice(0, 240) : '';
    // Keep destinations within the worker's own same-origin app scope.
    const path = typeof data.url === 'string' && /^\/community(?:\/|$|\?)/.test(data.url) &&
      !/[\\\r\n]/.test(data.url) && !/%(?:2f|5c|00)/i.test(data.url)
      ? data.url.slice(1) : 'community';
    const url = new URL(path, self.registration.scope);
    if (url.origin !== self.location.origin ||
        !url.href.startsWith(self.registration.scope)) return;
    await self.registration.showNotification(title, {
      body,
      icon: new URL('pwa-icon-192.png', self.registration.scope).href,
      data: { url: url.href },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    let url;
    try {
      url = new URL(event.notification.data?.url);
      const communityRoot = new URL('community', self.registration.scope);
      if (url.origin !== self.location.origin ||
          !(url.pathname === communityRoot.pathname ||
            url.pathname.startsWith(`${communityRoot.pathname}/`))) return;
    } catch {
      return;
    }
    const openClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of openClients) {
      if (client.url === url.href) {
        await client.focus();
        return;
      }
    }
    await clients.openWindow(url.href);
  })());
});