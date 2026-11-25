// @vitest-environment happy-dom
// Spec: k.contract, clause "A loader declared for `a.x` bound at `a.y` does not compile and `manifest` throws E1515."
// Spec: k.contract Handlers: "`params` is `Infer` of the entry's `params` (`{}` without), `search` of a page's `search` or an API entry's `query`; ... `fn` is never annotated." Seed 1337.
// Spec: k.router, clause "A loader of an entry with `params: P` gives `fn` `params` of type `Infer<typeof P>`."
// Compile-time half of each "does not compile" claim: ./negative-types.test-d.ts; the calls here are untyped.
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type Infer, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { SEED, page, thrown } from "./contract-support.ts";

const Id = s.object({ id: s.id("Order") });
const Search = s.object({ q: s.string().optional(), n: s.int().optional() });
const Query = s.object({ q: s.string() });
const Out = s.object({ n: s.int() });
const View = s.object({ title: s.string() });
const Edit = s.object({ note: s.string() });

const k = contract("a", {
  "a.x": { path: "/x" },
  "a.y": { path: "/y" },
  "a.show": { path: "/o/:id", params: Id, search: Search },
  "a.api": { method: "GET", path: "/api/a/:id", params: Id, query: Query, output: Out },
  "a.add": { method: "POST", path: "/api/a", body: Edit, output: Out },
});
const other = contract("b", { "b.x": { path: "/x" } });
const loadApi = loader(k, "a.api", {}, async () => ok({ n: 1 }));
const add = action(k, "a.add", {}, () => ok({ n: 1 }));

describe("k.contract handlers name their entry", () => {
  it("A loader declared for `a.x` bound at `a.y` does not compile and `manifest` throws E1515", () => {
    const forX = loader(k, "a.x", { output: View }, async () => ok({ title: "x" }));
    const rest = { "a.show": { component: page }, "a.api": { loader: loadApi }, "a.add": { action: add } };
    expect(
      thrown(() => manifest(k, { "a.x": { component: page, loader: forX }, "a.y": { component: page }, ...rest })),
    ).toBeNull();
    const wrong = () =>
      Reflect.apply(manifest, undefined, [
        k,
        { "a.x": { component: page }, "a.y": { component: page, loader: forX }, ...rest },
      ]);
    expect(thrown(wrong)?.code).toBe("E1515");
  });

  it("a handler declared for another contract is E1515", () => {
    const foreign = loader(other, "b.x", { output: View }, async () => ok({ title: "b" }));
    const wrong = () =>
      Reflect.apply(manifest, undefined, [
        k,
        {
          "a.x": { component: page, loader: foreign },
          "a.y": { component: page },
          "a.show": { component: page },
          "a.api": { loader: loadApi },
          "a.add": { action: add },
        },
      ]);
    expect(thrown(wrong)?.code).toBe("E1515");
  });

  it("a page action declared for an API entry, or an API loader bound under a page, is E1515", () => {
    const pageAct = action(k, "a.x", { input: Edit }, () => ok(null));
    const wrong = () =>
      Reflect.apply(manifest, undefined, [
        k,
        {
          "a.x": { component: page },
          "a.y": { component: page },
          "a.show": { component: page },
          "a.api": { loader: loadApi },
          "a.add": { action: pageAct },
        },
      ]);
    expect(thrown(wrong)?.code).toBe("E1515");
  });

  it("a loader of an entry with `params: P` gives `fn` `params` of type `Infer<typeof P>`, and `{}` without", () => {
    loader(k, "a.show", { output: View }, async ({ params, search }) => {
      expectTypeOf(params).toEqualTypeOf<Infer<typeof Id>>();
      expectTypeOf(search).toEqualTypeOf<Infer<typeof Search>>();
      return ok({ title: String(params.id) });
    });
    loader(k, "a.x", { output: View }, async ({ params, search }) => {
      expectTypeOf(params).toEqualTypeOf<Record<string, never>>();
      expectTypeOf(search).toEqualTypeOf<Record<string, never>>();
      return ok({ title: "x" });
    });
    expect(true).toBe(true);
  });

  it("an API loader's `search` is `Infer` of the entry's `query`, and it returns `Result` of the entry's `output`", () => {
    loader(k, "a.api", {}, async ({ params, search }) => {
      expectTypeOf(params).toEqualTypeOf<Infer<typeof Id>>();
      expectTypeOf(search).toEqualTypeOf<Infer<typeof Query>>();
      return ok({ n: 1 });
    });
    // the answer that is not the entry's `output` does not compile: ./negative-types.test-d.ts
    expect(true).toBe(true);
  });

  it("an API action's `fn` gets the decoded `body` typed from the entry; a page action's `fn` gets the declared `input`", () => {
    action(k, "a.add", {}, (body) => {
      expectTypeOf(body).toEqualTypeOf<Infer<typeof Edit>>();
      return ok({ n: 1 });
    });
    action(k, "a.x", { input: Edit }, (input) => {
      expectTypeOf(input).toEqualTypeOf<Infer<typeof Edit>>();
      return ok(null);
    });
    expect(true).toBe(true);
  });

  it("a declared-for-id mismatch is E1515 for every pair of distinct page ids", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,5}$/), { minLength: 2, maxLength: 4 }), (names) => {
        const entries = Object.fromEntries(names.map((n) => [`m.${n}`, { path: `/${n}` }]));
        const mc = Reflect.apply(contract, undefined, ["m", entries]);
        const handlers = names.map((n) =>
          Reflect.apply(loader, undefined, [mc, `m.${n}`, { output: View }, async () => ok({ title: n })]),
        );
        const aligned = Object.fromEntries(names.map((n, i) => [`m.${n}`, { component: page, loader: handlers[i] }]));
        expect(thrown(() => Reflect.apply(manifest, undefined, [mc, aligned]))).toBeNull();
        const rotated = Object.fromEntries(
          names.map((n, i) => [`m.${n}`, { component: page, loader: handlers[(i + 1) % names.length] }]),
        );
        expect(thrown(() => Reflect.apply(manifest, undefined, [mc, rotated]))?.code).toBe("E1515");
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
