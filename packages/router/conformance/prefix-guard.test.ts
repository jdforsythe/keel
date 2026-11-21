// @vitest-environment happy-dom
// Spec: k.prefix, clause "A guard on a prefixed route that redirects to a prefixed route keeps `p`: `/de-DE/...` redirects under `/de-DE/`, an unprefixed URL to an unprefixed one." (rfc:0079) Seed 1337.
import { createCtx } from "@keel/ctx";
import { createRouter, guard, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { err, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { memoryHistory, settle } from "./fixtures.ts";
import { LOCALES, Locale, RUNS, SEED, itemIds } from "./prefix-fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const Denied = s.error("keel.denied", s.object({}));
const Q = s.object({ next: s.string().optional() });
const P = s.object({ p: Locale });
const page = (): Node => document.createElement("section");
const deny = guard({ redirect: "g.login" }, async () => err(Denied.make({})));
const g = contract("g", {
  "g.login": { path: "/:p/login", params: P, search: Q },
  "g.secret": { path: "/:p/secret/:id", params: s.object({ p: Locale, id: s.string({ min: 1, max: 8 }) }) },
});

const routes = manifest(g, {
  "g.login": { component: page },
  "g.secret": { component: page, guard: deny },
});

describe("k.prefix guard", () => {
  test("a guard on a prefixed route that redirects to a prefixed route keeps p: /de-DE/... redirects under /de-DE/, an unprefixed URL to an unprefixed one", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...LOCALES), fc.stringMatching(itemIds), async (p, id) => {
        const history = memoryHistory("/");
        const router = createRouter(routes, { ctx: createCtx({ mode: "sim", seed: SEED }), history });
        const host = document.createElement("div");
        document.body.append(host);
        const off = mount(router.App, host, { ctx: simCtx });
        await settle();
        await router.navigate(g.href("g.secret", { p, id }));
        await settle();
        expect(router.route.get()).toMatchObject({ id: "g.login", params: { p } });
        const url = history.current();
        expect(url.startsWith(p === "en-US" ? "/login" : "/de-DE/login")).toBe(true);
        off();
        router.dispose();
        host.remove();
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
