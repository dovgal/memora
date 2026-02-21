/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, NetworkOnly, ExpirationPlugin, CacheableResponsePlugin, BackgroundSyncPlugin } from "serwist";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const bgSyncPlugin = new BackgroundSyncPlugin('study-progress-queue', {
    maxRetentionTime: 24 * 60 // Retry for max of 24 Hours (specified in minutes)
});

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        {
            matcher({ url, request }) {
                return url.pathname.startsWith('/api/study/progress') && request.method === 'POST';
            },
            handler: new NetworkOnly({
                plugins: [bgSyncPlugin]
            }),
        },
        {
            matcher({ url }) {
                return url.pathname.startsWith('/api/sets');
            },
            handler: new NetworkFirst({
                cacheName: 'api-sets-cache',
                networkTimeoutSeconds: 5,
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 50,
                        maxAgeSeconds: 30 * 24 * 60 * 60,
                    }),
                    new CacheableResponsePlugin({
                        statuses: [0, 200],
                    }),
                ],
            }),
        },
        {
            matcher({ url }) {
                return url.pathname.startsWith('/api/user') || url.pathname.startsWith('/api/study');
            },
            handler: new NetworkFirst({
                cacheName: 'api-user-cache',
                networkTimeoutSeconds: 5,
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 20,
                        maxAgeSeconds: 14 * 24 * 60 * 60,
                    }),
                ],
            }),
        },
        ...defaultCache,
    ],
});

serwist.addEventListeners();
