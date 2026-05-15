self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const options = {
        body: data.body,
        icon: '/favicon.ico', // Update with your actual icon path
        vibrate: [200, 100, 200, 100, 200], // Distinct vibration pattern
        data: {
          url: data.url || '/driver-portal'
        }
      };
      
      event.waitUntil(self.registration.showNotification(data.title, options));
    } catch (e) {
      // Fallback if the payload isn't JSON
      event.waitUntil(self.registration.showNotification("New Notification", { body: event.data.text() }));
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});