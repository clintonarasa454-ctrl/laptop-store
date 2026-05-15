self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'You have a new delivery assigned!',
      icon: '/favicon.ico',
      badge: '/favicon.ico', // Small monochrome icon for Android status bar
      vibrate: [200, 100, 200, 100, 200, 100, 200], // Distinctive delivery vibration pattern
      data: {
        url: data.url || '/driver-portal'
      },
      requireInteraction: true // Keeps the notification on screen until the driver taps it
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'New Delivery', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // When the driver taps the notification, open the Driver Portal
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});