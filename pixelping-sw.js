/* PixelPing Batch 15: static generator offline shell only.
 * Never cache authentication, Stripe, webhook, telemetry or dynamic API data.
 * Increment CACHE_VERSION when deploying a new shell or script version.
 */
'use strict';
const CACHE_VERSION = 'pixelping-static-v73-production-1';
const CACHE_PREFIX = 'pixelping-static-';
const SCOPE = self.registration.scope;
const SHELL_URL = new URL('index.html', SCOPE).href;
const ARSENAL_URL = new URL('arsenal.js', SCOPE).href;
const CDN_SCRIPTS = [
    'https://cdn.tailwindcss.com/',
    'https://cdn.jsdelivr.net/npm/qr-code-styling@1.5.0/lib/qr-code-styling.js'
];
const ICON_CLIENT_URLS = ['icon-catalog.js', 'icon-library.js', 'saved-codes-client.js', 'my-codes.js', 'ui-colors.css', 'feature-help.js', 'terms-manifest.js', 'terms-client.js', 'qr-names-client.js', 'recovery-inventory.js', 'terms.html', 'privacy.html', 'terms-2026-10-17-v1.html', 'privacy-2026-10-17-v1.html'].map(path => new URL(path, SCOPE).href);
const STATIC_URLS = [SHELL_URL, ARSENAL_URL, ...ICON_CLIENT_URLS, ...CDN_SCRIPTS];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);
        // A partially fetched application is not an offline-ready application.
        // Cache external scripts as opaque no-CORS responses: the same script
        // tags requested them without CORS in the original application.
        await cache.addAll([SHELL_URL, ARSENAL_URL, ...ICON_CLIENT_URLS]);
        await Promise.all(CDN_SCRIPTS.map(async url => {
            const response = await fetch(new Request(url, { mode: 'no-cors', cache: 'reload' }));
            if (!response || (response.type !== 'opaque' && !response.ok)) {
                throw new Error('Required offline dependency unavailable');
            }
            await cache.put(url, response);
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const shell = url.origin === new URL(SCOPE).origin &&
        (url.pathname === new URL(SHELL_URL).pathname || url.pathname === new URL(SCOPE).pathname);
    const arsenal = url.href === ARSENAL_URL;
    const iconClient = ICON_CLIENT_URLS.includes(url.href);
    const requiredCDN = CDN_SCRIPTS.includes(url.href);
    if (!shell && !arsenal && !iconClient && !requiredCDN) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_VERSION);
        // A versioned CDN runtime remains stable offline and only updates when
        // a new service worker version deploys; never cache other CDN URLs.
        if (requiredCDN) {
            const cached = await cache.match(url.href);
            if (cached) return cached;
            return fetch(request);
        }
        // Latest HTML/Arsenal when online, cached shell when disconnected.
        try {
            const live = await fetch(request);
            if (live.ok) await cache.put(iconClient ? url.href : arsenal ? ARSENAL_URL : SHELL_URL, live.clone());
            return live;
        } catch (error) {
            const cached = await cache.match(iconClient ? url.href : arsenal ? ARSENAL_URL : SHELL_URL);
            if (cached) return cached;
            throw error;
        }
    })());
});
