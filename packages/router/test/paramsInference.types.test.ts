// Examples: a loader's and action's `params` and `search` are `Infer` of the schemas of the entry they name (k.contract
// Handlers); an entry without the schema gives `{}`, a layout's are the matched route's (`unknown`), and a handler
// bound at an entry it was not declared for fails at `manifest` (E1515).
import { createCtx } from "@keel/ctx";
import { type Id, ok, s } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";

const TodoParams = s.object({ todoId: s.id("Todo") });
const Filter = s.object({ filter: s.enum(["all", "done"]).optional() });
const Out = s.object({ id: s.id("Todo") });
const Plain = s.object({ n: s.int() });
const page = (): Node => document.createTextNode("");

const t = contract("t", {
  "t.shell": { layout: true },
  "t.show": { path: "/t/:todoId", params: TodoParams, search: Filter },
  "t.plain": { path: "/plain" },
  "t.other": { path: "/other" },
});

const load = loader(t, "t.show", { output: Out }, async ({ params, search }) => {
  expectTypeOf(params).toEqualTypeOf<{ todoId: Id<"Todo"> }>();
  expectTypeOf(search).toEqualTypeOf<{ filter?: "all" | "done" | undefined }>();
  return ok({ id: params.todoId });
});
const save = action(t, "t.show", { input: s.object({}) }, (_input, { params, url }) => {
  expectTypeOf(params).toEqualTypeOf<{ todoId: Id<"Todo"> }>();
  expectTypeOf(url).toEqualTypeOf<string>();
  return ok(params.todoId === "" ? null : null);
});
const plain = loader(t, "t.plain", { output: Plain }, async ({ params, search }) => {
  expectTypeOf(params).toEqualTypeOf<Record<string, never>>();
  expectTypeOf(search).toEqualTypeOf<Record<string, never>>();
  return ok({ n: 1 });
});
const shell = loader(t, "t.shell", { output: Plain }, async ({ params, search }) => {
  expectTypeOf(params).toEqualTypeOf<unknown>();
  expectTypeOf(search).toEqualTypeOf<unknown>();
  return ok({ n: 1 });
});
const forOther = loader(t, "t.other", { output: Plain }, async () => ok({ n: 1 }));

const bind = () =>
  manifest(t, {
    "t.shell": { component: page, loader: shell },
    "t.show": { component: page, loader: load, POST: save },
    "t.plain": { component: page, loader: plain },
    "t.other": { component: page },
  });

describe("loader and action params/search", () => {
  it("name the entry: the loader and action carry its id, so a binding at another key does not fit", () => {
    expectTypeOf(load.id).toEqualTypeOf<"t.show">();
    expectTypeOf(save.id).toEqualTypeOf<"t.show">();
    expect(bind).not.toThrow();
  });

  it("a loader bound at an entry it was not declared for fails at manifest with E1515", () => {
    const bad = () =>
      // The type error is in negativeTypes.test-d.ts; called untyped here.
      Reflect.apply(manifest, undefined, [
        t,
        {
          "t.shell": { component: page },
          "t.show": { component: page, loader: forOther },
          "t.plain": { component: page },
          "t.other": { component: page },
        },
      ]);
    expect(bad).toThrow(/^E1515 t\.show/);
  });

  it("an action bound at another page fails at manifest with E1515", () => {
    const bad = () =>
      Reflect.apply(manifest, undefined, [
        t,
        {
          "t.shell": { component: page },
          "t.show": { component: page },
          "t.plain": { component: page },
          "t.other": { component: page, PUT: save },
        },
      ]);
    expect(bad).toThrow(/^E1515 t\.other/);
  });

  it("a loader runs with the router's parsed params and the url", async () => {
    const params = TodoParams.parse({ todoId: "t9" });
    expect(params.ok).toBe(true);
    if (!params.ok) return;
    const r = await load.run(
      { params: params.value, search: {}, url: "http://localhost/t/t9", caller: "", stores: undefined },
      createCtx({ mode: "sim" }),
    );
    expect(r).toEqual({ ok: true, value: { id: "t9" } });
  });
});
