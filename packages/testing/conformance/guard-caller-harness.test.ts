// @vitest-environment happy-dom
// Spec: k.guards, clause "A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`)." (rfc:0070)
// The renderRoute half; packages/server/conformance/guard-caller.test.ts covers createApp. Seed 1337.
import { guard, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const Denied = s.error("keel.denied", s.object({}));
const seen: { guard: string[]; loader: string[] } = { guard: [], loader: [] };
const p = (id: string): HTMLElement => {
  const e = document.createElement("p");
  e.id = id;
  e.textContent = id;
  return e;
};
const routes = manifest({
  "gc.login": { path: "/login", component: () => p("gc.login") },
  "gc.home": {
    path: "/home",
    guard: guard({ redirect: "gc.login" }, async ({ caller }) => {
      seen.guard.push(caller);
      return caller === "" ? err(Denied.make({})) : ok(null);
    }),
    loader: loader({ output: s.object({}) }, async ({ caller }) => {
      seen.loader.push(caller);
      return ok({});
    }),
    component: () => p("gc.home"),
  },
});

test("under renderRoute a guard gets the caller option, the same value its loader gets", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9_-]{1,43}$/), async (caller) => {
      seen.guard.length = 0;
      seen.loader.length = 0;
      const h = await renderRoute("gc.home", { routes, ctx: simCtx(), caller });
      expect(seen.guard).toEqual([caller]);
      expect(seen.loader).toEqual([caller]);
      expect(h.route().id).toBe("gc.home");
      h.dispose();
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("without the option the caller is '' and a guard denying '' redirects", async () => {
  seen.guard.length = 0;
  const h = await renderRoute("gc.home", { routes, ctx: simCtx() });
  expect(seen.guard).toEqual([""]);
  expect(h.route().id).toBe("gc.login");
  h.dispose();
});
