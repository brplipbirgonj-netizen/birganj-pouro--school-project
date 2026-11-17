'use client';
import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch(() => {});
    }
  }, []);
  return null;
}
