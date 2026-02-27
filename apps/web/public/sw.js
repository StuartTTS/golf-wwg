self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};

  const title = data.title || 'Golf WWG';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      url: data.url || '/home',
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data?.url || '/home';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
