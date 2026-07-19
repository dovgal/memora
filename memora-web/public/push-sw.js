// Автономный service worker ТОЛЬКО для push-напоминаний.
// Никакого кэширования (в отличие от serwist app/sw.ts, отключённого из-за
// проблем со stale-кэшем на Railway) — поэтому его безопасно регистрировать.
// Сервер шлёт ПУСТОЙ push (без payload, см. memora-api/src/pushsvc.rs): весь
// текст уведомления живёт здесь.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Memora', {
      body: 'Пора повторять — упражнения ждут 📚',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'memora-reminder', // повторные напоминания заменяют, а не копятся
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/cabinet');
    })
  );
});
