# third-party-origin

One page shows a map tile from `https://tile.openstreetmap.org`. The `web` deployable in `topology.ts` declares that origin under `origins.img` with its reason, so `keel check` accepts the absolute `Image src` in `modules/app/HomePage.tsx` and every document's Content-Security-Policy reads `img-src 'self' https://tile.openstreetmap.org`. No other directive widens.

`test/origin.test.ts` renders the page and reads the policy header from `createApp`. Run `keel check`, `keel test` and `keel build`; `node dist/web/server.mjs` serves the page on `PORT` (default 8080).
