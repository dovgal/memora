/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, ExpirationPlugin, CacheableResponsePlugin } from "serwist";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
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
