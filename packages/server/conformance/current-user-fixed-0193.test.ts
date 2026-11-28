// k.user, User "In those cases `currentUser.fixed` is true, else false." ("those cases": no identity source; a stream whose `user` came from a verified `x-keel-user` or from `renderRoute`'s `user`.)
// Seed 1337 (fc.assert below).
// Assumption: a live loader reads `currentUser.fixed` from its args' `currentUser`. The verified `x-keel-user` and `renderRoute` cases need other packages (`service`, `@keel/render`): covered only by the no-identity-source and identify cases here.
// @vitest-environment node
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { liveLoader, readChunks } from "./topology-fixtures.ts";

const SEED = 1337;
const Out = s.object({ fixed: s.boolean() });

async function fixedOf(identify: ((a: { request: Request; caller: string }) => Promise<string>) | undefined) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const c = contract("app", { "app.live": { method: "GET", path: "/api/live", events: true, output: Out } });
  const live = liveLoader(c, "app.live", async function* (args: { currentUser: { fixed: boolean } }) {
    yield ok({ fixed: args.currentUser.fixed });
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(c, { "app.live": { loader: live } }),
    ctx,
    mode: "production",
    ...(identify === undefined ? {} : { identity: identity({ identify: async (a) => identify(a) }) }),
  });
  const ac = new AbortController();
  const res = await app.fetch(
    new Request("http://localhost/api/live", { headers: { accept: "text/event-stream" }, signal: ac.signal }),
  );
  const text = (await readChunks(res, 1)).join("");
  ac.abort();
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  return line === undefined ? undefined : JSON.parse(line.slice(5));
}

test("With no identity source, `currentUser.fixed` is true", async () => {
  expect(await fixedOf(undefined)).toEqual({ ok: true, value: { fixed: true } });
});

test("With an identity source, whatever it answers, `currentUser.fixed` is false", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{0,8}$/), async (u) => {
      expect(await fixedOf(async () => u)).toEqual({ ok: true, value: { fixed: false } });
    }),
    { seed: SEED, numRuns: 8 },
  );
});
