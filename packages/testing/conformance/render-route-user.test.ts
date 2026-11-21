// @vitest-environment happy-dom
// Spec: k.user, Conformance "With `identify` answering `'u1'`, a guard, a loader, an action and a live loader's stream each get `user` `'u1'`, one `identify` call per request; with no identity source, `''`; `renderRoute(id, { user: 'u1' })` gives guard and loader `'u1'`."
// Spec: k.user, User "Guards, loaders (live too) and actions get `user: string` beside `caller`: `identify`'s answer; `''` with no identity source, on a `client` deployable, or under `renderRoute` without its `user` option."
// The createApp half is packages/server/conformance/identity-user.test.ts. Seed 1337 (fc.assert below).
// Untestable here: `user` `''` on a `client` deployable (its loaders run in a browser; no public harness runs one beyond this renderRoute default).
import { guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const Denied = s.error("keel.denied", s.object({}));
const seen: { guard: [string, string][]; loader: [string, string][] } = { guard: [], loader: [] };
const p = (id: string): HTMLElement => {
  const e = document.createElement("p");
  e.id = id;
  e.textContent = id;
  return e;
};
const urContract = contract("ur", { "ur.login": { path: "/login" }, "ur.home": { path: "/home" } });
const routes = manifest(urContract, {
  "ur.login": { component: () => p("ur.login") },
  "ur.home": {
    component: () => p("ur.home"),
    loader: loader(urContract, "ur.home", { output: s.object({}) }, async ({ user, caller }) => {
      seen.loader.push([user, caller]);
      return ok({});
    }),
    guard: guard({ redirect: "ur.login" }, async ({ user, caller }) => {
      seen.guard.push([user, caller]);
      return user === "" ? err(Denied.make({})) : ok(null);
    }),
  },
});

test("`renderRoute(id, { user: 'u1' })` gives guard and loader `'u1'`", async () => {
  const h = await renderRoute("ur.home", { routes, ctx: simCtx(), user: "u1" });
  try {
    expect(seen.guard.at(-1)?.[0]).toBe("u1");
    expect(seen.loader.at(-1)?.[0]).toBe("u1");
    expect(h.route().id).toBe("ur.home");
  } finally {
    h.dispose();
  }
});

test("under renderRoute a guard and a loader get the `user` option, beside the `caller` option, whatever the id", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 256 }),
      fc.stringMatching(/^[A-Za-z0-9_-]{0,43}$/),
      async (user, caller) => {
        seen.guard.length = 0;
        seen.loader.length = 0;
        const h = await renderRoute("ur.home", { routes, ctx: simCtx(), user, caller });
        try {
          expect(seen.guard).toEqual([[user, caller]]);
          expect(seen.loader).toEqual([[user, caller]]);
        } finally {
          h.dispose();
        }
      },
    ),
    { seed: SEED, numRuns: 20 },
  );
});

test("under renderRoute without its `user` option, `user` is `''` and a guard denying `''` redirects", async () => {
  seen.guard.length = 0;
  const h = await renderRoute("ur.home", { routes, ctx: simCtx(), caller: "c1" });
  try {
    expect(seen.guard).toEqual([["", "c1"]]);
    expect(h.route().id).toBe("ur.login");
  } finally {
    h.dispose();
  }
});
