'use client';

import { useEffect } from 'react';
import { watchServiceWorkerController } from '@/src/shared/lib/service-worker';

const SW_URL = '/sw.js';

export default function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_URL, {
          scope: '/',
          updateViaCache: 'none',
        });

        registration.update().catch(() => {});

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state !== 'installed') return;
            if (!navigator.serviceWorker.controller) return;
            installingWorker.postMessage({ type: 'SKIP_WAITING' });
          });
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to register service worker', error);
        }
      }
    };

    register();

    const stopWatchingController = watchServiceWorkerController(navigator.serviceWorker, () =>
      window.location.reload()
    );

    return () => {
      cancelled = true;
      stopWatchingController();
    };
  }, []);

  return null;
}
