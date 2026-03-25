'use client';

import { useEffect } from 'react';

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

    const onControllerChange = () => {
      if (!cancelled) {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
