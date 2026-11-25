// @vitest-environment happy-dom
// Spec: k.contract (Binding) "an API GET `{ loader, guard? }`; an API write `{ action, guard? }`"; RFC 0157 Proposal 2 "A page's actions sit in its entry by verb; an API entry's one handler sits under `loader` or `action`, its method being the contract's."
// Spec: k.api, clause "An API entry bound with a `component` does not compile and `manifest()` throws E1510." Seed 1337.
// Compile-time half of each "does not compile" claim: ./negative-types.test-d.ts; the calls here are untyped.
import { action, guard, loader, manifest, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { matchHref } from "@keel/router/match";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { codeOf, page } from "./contract-support.ts";

const Out = s.object({ n: s.int() });
const Denied = s.error("keel.denied", s.object({}));
const c = contract("a", {
  "a.home": { path: "/" },
  "a.box": { method: "GET", path: "/api/a", output: Out },
  "a.add": { method: "POST", path: "/api/a", body: Out, output: Out },
  "a.drop": { method: "DELETE", path: "/api/a/:id", params: s.object({ id: s.string() }), output: s.object({}) },
});
const box = loader(c, "a.box", {}, async () => ok({ n: 1 }));
const add = action(c, "a.add", {}, () => ok({ n: 1 }));
const drop = action(c, "a.drop", {}, () => ok({}));

describe("k.contract API bindings", () => {
  it("An API entry bound with a `component` does not compile and `manifest()` throws E1510", () => {
    const bad = () =>
      Reflect.apply(manifest, undefined, [
        c,
        {
          "a.home": { component: page },
          "a.box": { loader: box, component: page },
          "a.add": { action: add },
          "a.drop": { action: drop },
        },
      ]);
    expect(codeOf(bad)).toBe("E1510");
  });

  it("an API GET bound to `action`, or a write bound to `loader`, does not compile and throws", () => {
    const getAction = () =>
      Reflect.apply(manifest, undefined, [
        c,
        {
          "a.home": { component: page },
          "a.box": { action: add },
          "a.add": { action: add },
          "a.drop": { action: drop },
        },
      ]);
    expect(codeOf(getAction)).toMatch(/^E151[05]$/);
    const writeLoader = () =>
      Reflect.apply(manifest, undefined, [
        c,
        {
          "a.home": { component: page },
          "a.box": { loader: box },
          "a.add": { loader: box },
          "a.drop": { action: drop },
        },
      ]);
    expect(codeOf(writeLoader)).toMatch(/^E151[05]$/);
  });

  it("a guard without `redirect` on an API entry is clean; on a page it does not compile and `manifest()` throws E1508", () => {
    const open = guard({}, async () => err(Denied.make({})));
    expect(
      codeOf(() =>
        manifest(c, {
          "a.home": { component: page },
          "a.box": { loader: box, guard: open },
          "a.add": { action: add },
          "a.drop": { action: drop },
        }),
      ),
    ).toBeNull();
    const bad = () =>
      Reflect.apply(manifest, undefined, [
        c,
        {
          "a.home": { component: page, guard: open },
          "a.box": { loader: box },
          "a.add": { action: add },
          "a.drop": { action: drop },
        },
      ]);
    expect(codeOf(bad)).toBe("E1508");
  });

  it("`routes.json` gains `method` for an API entry, and `actions` lists an API write entry's method", () => {
    const routes = manifest(c, {
      "a.home": { component: page },
      "a.box": { loader: box },
      "a.add": { action: add },
      "a.drop": { action: drop },
    });
    const art = routesArtifact(routes);
    expect(art["a.box"]).toEqual(expect.objectContaining({ method: "GET", path: "/api/a", actions: [] }));
    expect(art["a.add"]).toEqual(expect.objectContaining({ method: "POST", actions: ["POST"] }));
    expect(art["a.drop"]).toEqual(expect.objectContaining({ method: "DELETE", actions: ["DELETE"] }));
    expect(art["a.home"]?.path).toBe("/");
  });

  it("`matchHref` of an API entry's path is `null`", () => {
    const routes = manifest(c, {
      "a.home": { component: page },
      "a.box": { loader: box },
      "a.add": { action: add },
      "a.drop": { action: drop },
    });
    const alias = manifest(contract("z", { "z.box": { path: "/api/a" } }), { "z.box": { component: page } });
    expect(matchHref(routes, alias.contract.href("z.box"))).toBeNull();
    expect(matchHref(routes, c.href("a.home"))?.id).toBe("a.home");
  });
});
