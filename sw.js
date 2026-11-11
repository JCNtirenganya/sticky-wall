/* Presence only: gives the phone and board an installable app.
   It deliberately keeps no cache, so a new deploy is picked up on reload. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
/* A fetch listener is required for the app to be installable. Doing
   nothing lets the browser fetch normally, so nothing goes stale. */
self.addEventListener("fetch", () => {});
