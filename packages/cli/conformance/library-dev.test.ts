// Spec: k.library, the clause on `keel dev` serving a library's element, quoted whole:
// 15. "In the `site` project of the second bullet, the document `keel dev` serves at `/` holds an element with id `shop.badge.box`."
// The `site` project is the second clause: "In that project, with the app's `tokens.ts` and a `static` deployable `site` whose `/` page renders `<Badge id=\"shop.badge\" />`, `keel build`'s `dist/site/index.html` holds an element with id `shop.badge.box`, and a `.css` file under `dist/site/` holds the atomic rule of `p=\"2\"`, which the same build without `p=\"2\"` in the library lacks."
// In an app (compiler): "The compiler resolves imports with the `keel` condition on every surface (dev, build, test) and transforms a library's files as the app's, read at `modules/<id>/<f>`: JSX, element ids, and style props into the app's CSS file against the app's `tokens.ts`; the `.keel/` artifacts derive from a library's files at those paths as from the app's, and E1005 compares them over the same files, so a reader of an artifact (E1702, the inspector) judges a library's element as an app's. A linked library's imports resolve from its real folder, as Node's do, so the kernel packages it imports must resolve there to the app's (one workspace install)."
// Seed: 1337 (no generated input: one fixture, one `keel dev` on a free port from a closed port-0 listener, never 8080, 5173, 5214 or 5432; the child's group ended in `finally`).
// Binary runs: 1 (`keel dev`). ASSUMPTION: the document is a GET of `/` with `accept: text/html` (static-support.ts), read after `keel dev` printed its ready line for the port.
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { SLOW, freePort, get, served, startDev, stop, stopAll } from "./static-support.ts";
import { siteTree } from "./library-support.ts";

let dir = "";
beforeAll(() => {
  dir = materialize(siteTree());
}, SLOW);
afterAll(() => cleanup(dir));
afterEach(async () => {
  await stopAll();
});

test(
  "In the `site` project of the second bullet, the document `keel dev` serves at `/` holds an element with id `shop.badge.box`",
  async () => {
    const port = await freePort();
    const p = startDev(dir, port);
    try {
      expect(await served(p, port), p.out()).toBe(true);
      const res = await get(port, "/");
      expect(res?.status).toBe(200);
      expect(res?.body).toContain('id="shop.badge.box"');
    } finally {
      await stop(p);
    }
  },
  SLOW,
);
