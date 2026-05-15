import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

// Utility function to convert the base64 public key to Uint8Array (required by PushManager)
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(agentId: number | undefined) {
  // Fetch the public VAPID key from the server
  const { data: vapidPublicKey } = trpc.fleet.getVapidPublicKey.useQuery(undefined, {
    staleTime: Infinity,
  });
  
  const saveSubscription = trpc.fleet.savePushSubscription.useMutation();

  useEffect(() => {
    if (!agentId || !vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    async function registerPush() {
      try {
        // 1. Register the Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // 2. Request Notification Permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('Push notification permission denied by the driver.');
          return;
        }

        // 3. Check for existing subscription or create a new one
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!)
          });
        }

        // 4. Save the subscription to the database
        saveSubscription.mutate({ agentId, subscription: JSON.parse(JSON.stringify(subscription)) });
      } catch (error) {
        console.error('Error registering push notifications:', error);
      }
    }

    registerPush();
  }, [vapidPublicKey, agentId]);
}