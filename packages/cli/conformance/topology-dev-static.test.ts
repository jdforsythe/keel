// Spec: k.topology, Conformance "`keel dev` answers a `static` deployable's route with the document its `createApp` renders, its loader's text in it."
// Seed: 1337 (no generated input: one fixture, one spawn). `keel dev --port p` with `p` from a closed listener on port 0, a bounded retry of a GET, the child's group ended in `finally` (static-support.ts).
// Pending: dev serves no `static` deployable's paths yet. ASSUMPTION: a document request is a GET with `accept: text/html`; the document holds the loader's text.
import { setTimeout as pause } from "node:timers/promises";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import {
  ABOUT_TEXT,
  HOME_TEXT,
  SLOW,
  freePort,
  get,
  startDev,
  stop,
  stopAll,
  staticTree,
  type Proc,
} from "./static-support.ts";

/** Waits for `keel dev`'s own ready line for `port` (`Local: http://<host>:<port>/`), then for a GET `/` to answer: a port another process took between `freePort` and the listen never matches. */
async function servedByDev(p: Proc, port: number): Promise<boolean> {
  const ready = new RegExp(`Local:\\s+http://[^\\s/]*:${port}/`);
  let done = false;
  void p.exited.then(() => {
    done = true;
  });
  for (let i = 0; i < 800 && !done; i++) {
    if (i > 0) await pause(50);
    if (ready.test(p.out()) && (await get(port, "/")) !== null) return true;
  }
  return false;
}

let dir = "";
beforeAll(() => {
  dir = materialize(staticTree());
}, SLOW);
afterAll(() => cleanup(dir));
afterEach(async () => {
  await stopAll();
});

test(
  "`keel dev` answers a `static` deployable's route with the document its `createApp` renders, its loader's text in it.",
  async () => {
    const port = await freePort();
    const p = startDev(dir, port);
    try {
      expect(await servedByDev(p, port), p.out()).toBe(true);
      for (const [path, want, other] of [
        ["/", HOME_TEXT, ABOUT_TEXT],
        ["/about", ABOUT_TEXT, HOME_TEXT],
      ] as const) {
        const res = await get(port, path);
        expect(res?.status, path).toBe(200);
        expect(res?.body, path).toContain(want);
        expect(res?.body, path).not.toContain(other);
      }
    } finally {
      await stop(p);
    }
  },
  SLOW,
);
