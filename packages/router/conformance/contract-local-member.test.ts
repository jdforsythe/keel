// @vitest-environment happy-dom
// Spec: k.contract, clause "`.keel/routes.json` of a contract with a `local: true` API entry marks that entry `local: true`; `local: false` on an entry is E1510."
// k.contract Local routes: "`.keel/routes.json` marks the entry `local: true`, so the surface shows it."
// k.contract Local routes: "`local` other than the literal `true` is E1510."
// k.contract Entries: "| page | `path` | `params`, `search`, `local` |" and "| API | `method`, `path`, `output` | `params`, `query`, `body`, `errors`, `timeout`, `events`, `local` |"; "A kind refuses members outside its row."
// Seed 1337. The data of `routes.json` is `routesArtifact(manifest)` (its `{ data, hash }` wrapper is the compiler's); the build's own `routes.json` is read in packages/server/conformance/local-routes-surface.test.ts.
// ASSUMED: the member is `local` on an entry of `routesArtifact`'s record, `true` for a local entry; for an entry that is not local the member is absent or not `true` (the spec says only that a local entry is marked). The calls are untyped, as the neighbouring E1510 files do.
import { action, loader, manifest, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, page, thrown } from "./contract-support.ts";

const Out = s.object({ n: s.int() });
const make = (entry: unknown): unknown =>
  thrown(() => Reflect.apply(contract, undefined, ["a", { "a.x": entry }]))?.code ?? null;

const fixture = () => {
  const c = contract("a", {
    "a.home": { path: "/", local: true },
    "a.plain": { path: "/plain" },
    "a.box": { method: "GET", path: "/api/box", output: Out, local: true },
    "a.add": { method: "POST", path: "/api/add", body: Out, output: Out, local: true },
    "a.open": { method: "GET", path: "/api/open", output: Out },
  });
  const routes = manifest(c, {
    "a.home": { component: page },
    "a.plain": { component: page },
    "a.box": { loader: loader(c, "a.box", {}, async () => ok({ n: 1 })) },
    "a.add": { action: action(c, "a.add", {}, () => ok({ n: 1 })) },
    "a.open": { loader: loader(c, "a.open", {}, async () => ok({ n: 1 })) },
  });
  return { c, routes };
};

describe("k.contract local member", () => {
  it("`.keel/routes.json` of a contract with a `local: true` API entry marks that entry `local: true`", () => {
    const { routes } = fixture();
    const art = routesArtifact(routes);
    expect(art["a.box"]).toEqual(expect.objectContaining({ method: "GET", path: "/api/box", local: true }));
    expect(art["a.add"]).toEqual(expect.objectContaining({ method: "POST", local: true }));
    expect(art["a.home"]).toEqual(expect.objectContaining({ path: "/", local: true }));
    for (const id of ["a.plain", "a.open"]) expect(Reflect.get(art[id] ?? {}, "local")).not.toBe(true);
  });

  it("`local: false` on an entry is E1510", () => {
    expect(make({ path: "/x", local: false })).toBe("E1510");
    expect(make({ method: "GET", path: "/x", output: Out, local: false })).toBe("E1510");
  });

  it("a page and an API entry of each method accept `local: true`, and a layout refuses it with E1510", () => {
    expect(make({ path: "/x", local: true })).toBeNull();
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"])
      expect(make({ method, path: "/x", output: Out, local: true }), method).toBeNull();
    expect(make({ layout: true, local: true })).toBe("E1510");
  });

  it("`local` other than the literal `true` is E1510, on a page and on an API entry", () => {
    const notTrue = fc.oneof(
      fc.constantFrom<unknown>(false, null, undefined, "true", "", 0, 1, [], {}, [true]),
      fc.string(),
      fc.integer(),
    );
    fc.assert(
      fc.property(notTrue, (v) => {
        expect(make({ path: "/x", local: v })).toBe("E1510");
        expect(make({ method: "GET", path: "/x", output: Out, local: v })).toBe("E1510");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
