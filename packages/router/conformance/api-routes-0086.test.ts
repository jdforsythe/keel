// @vitest-environment happy-dom
// Spec: k.api, clause "An entry with neither `component` nor `api: true` does not compile, and `manifest()` throws E1510 for it."
// Spec: k.api, clause "An API entry with `component` does not compile and throws E1510."
// Spec: k.api, clause "`routes.href` of an API route's id does not compile; `matchHref` of its path is `null`."
// Spec: k.api, clause "E1510 has a triggering fixture and a clean one."
// Spec: k.api, clause "A guard without `redirect` on an API route denies with 403 `keel.denied`; on a page it does not compile and `manifest()` throws E1508."
// Seed 1337.
// Compile failures are asserted at the type level: the literal is not assignable to the parameter `manifest` infers for
// it (checked by tsc); the runtime throw is reached with Reflect.apply (the mechanism rules-e1501-e1506.test.ts uses for ill-typed input).
import { action, guard, loader, manifest } from "@keel/router";
import type { RouteDef } from "@keel/router";
import { matchHref } from "@keel/router/match";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";

const SEED = 1337; // seed 1337
const page = (): Node => document.createElement("div");
const Out = s.object({ n: s.int() });
const read = loader({ output: Out }, async () => ok({ n: 1 }));
const write = action({ input: s.object({ note: s.string() }), output: s.object({}) }, async () => ok({}));

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  return null;
};
/** Whether a literal of type `L` is a valid `manifest()` argument; `false` means the call does not compile. */
type Compiles<L> = L extends Readonly<Record<string, RouteDef>> ? true : false;
const build = (entry: unknown): unknown => codeOf(() => Reflect.apply(manifest, undefined, [{ "t.one": entry }]));

describe("k.api", () => {
  it("An entry with neither `component` nor `api: true` does not compile, and `manifest()` throws E1510 for it.", () => {
    expectTypeOf<Compiles<{ "t.one": { path: "/t"; component: typeof page } }>>().toEqualTypeOf<true>();
    const literal = { "t.one": { path: "/t", loader: read } } as const;
    expectTypeOf<Compiles<typeof literal>>().toEqualTypeOf<false>();
    const bad = () => Reflect.apply(manifest, undefined, [literal]);
    expect(codeOf(bad)).toBe("E1510");
    fc.assert(
      fc.property(fc.constantFrom("/a", "/b/c", "/d"), (path) => {
        expect(build({ path })).toBe("E1510");
        expect(build({ path, loader: read })).toBe("E1510");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("An API entry with `component` does not compile and throws E1510.", () => {
    const literal = { "t.one": { api: true, path: "/t", loader: read, component: page } } as const;
    expectTypeOf<Compiles<typeof literal>>().toEqualTypeOf<false>();
    const bad = () => Reflect.apply(manifest, undefined, [literal]);
    expect(codeOf(bad)).toBe("E1510");
    for (const refused of [{ component: page }, { errorElement: page }, { title: "t" }, { layout: "t.shell" }]) {
      expect(build({ api: true, path: "/t", loader: read, ...refused })).toBe("E1510");
    }
  });

  it("`routes.href` of an API route's id does not compile; `matchHref` of its path is `null`.", () => {
    const routes = manifest({
      "api.lists": { api: true, path: "/api/lists", loader: read },
      "ops.home": { path: "/", component: page },
    });
    expect(routes.href("ops.home")).toBeDefined();
    expectTypeOf(routes.href).parameter(0).toEqualTypeOf<"ops.home">();
    const other = manifest({ "alias.lists": { path: "/api/lists", component: page } });
    expect(matchHref(routes, other.href("alias.lists"))).toBeNull();
    expect(matchHref(routes, routes.href("ops.home"))?.id).toBe("ops.home");
  });

  it("E1510 has a triggering fixture and a clean one.", () => {
    const clean = [{ api: true, path: "/a", loader: read }, { path: "/p", component: page }, { component: page }];
    for (const entry of clean) expect(build(entry)).toBeNull();
    expect(build({ api: true, path: "/a", loader: read, title: "x" })).toBe("E1510");
    expect(build({ api: true, loader: read })).toBe("E1510");
    // An API route with an action and no loader is clean; with neither, E1510 on the first read of the table.
    const withAction = manifest({ "t.act": { api: true, path: "/act" } });
    expect(codeOf(() => withAction.actions({ "t.act": { POST: write } }))).toBeNull();
    const neither = codeOf(() => {
      const m = Reflect.apply(manifest, undefined, [{ "t.none": { api: true, path: "/none" } }]);
      return m.href("t.none");
    });
    expect(neither).toBe("E1510");
  });

  it("A guard without `redirect` on a page does not compile and `manifest()` throws E1508; on an API route it builds clean.", () => {
    const open = guard({}, async () => err(s.error("keel.denied", s.object({})).make({})));
    const literal = { "t.one": { path: "/t", component: page, guard: open } } as const;
    expectTypeOf<Compiles<typeof literal>>().toEqualTypeOf<false>();
    const bad = () => Reflect.apply(manifest, undefined, [literal]);
    expect(codeOf(bad)).toBe("E1508");
    expect(build({ path: "/t", component: page, guard: open })).toBe("E1508");
    expect(build({ api: true, path: "/t", loader: read, guard: open })).toBeNull();
  });
});
