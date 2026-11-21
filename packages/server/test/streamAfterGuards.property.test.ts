// @vitest-environment happy-dom
// k.api Requests: a request for a stream on an entry that is not live answers 406 only after the entry's guards run,
// so a denying guard answers 403 whether or not the entry is live; past the guards, a live entry streams and any
// other entry is 406. Seed 1337.
import { createCtx } from "@keel/ctx";
import { guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Out = s.object({ n: s.int() });
const Denied = s.error("keel.denied", s.object({}));
const c = contract("a", {
  "a.live": { method: "GET", path: "/api/live", output: Out, events: true },
  "a.plain": { method: "GET", path: "/api/plain", output: Out },
});
let allow = false;
const gate = guard({}, async () => (allow ? ok(null) : err(Denied.make({}))));
const live = loader(c, "a.live", {}, async function* () {
  yield ok({ n: 1 });
});
const plain = loader(c, "a.plain", {}, async () => ok({ n: 1 }));
const app = await createApp({
  topology: topology({ web: { modules: ["a"], adapter: "node" } }),
  routes: manifest(c, { "a.live": { loader: live, guard: gate }, "a.plain": { loader: plain, guard: gate } }),
  ctx: createCtx({ mode: "sim", seed: 1337 }),
  mode: "production",
});
const stream = (path: string) =>
  app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/event-stream" } }));

describe("a stream request and the guards", () => {
  it("a denying guard answers 403 on the live and the plain entry alike; allowed, the plain one is 406", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.constantFrom("/api/live", "/api/plain"), async (allowed, path) => {
        allow = allowed;
        const res = await stream(path);
        const expected = !allowed ? 403 : path === "/api/plain" ? 406 : 200;
        expect([path, allowed, res.status]).toEqual([path, allowed, expected]);
        await res.body?.cancel();
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
