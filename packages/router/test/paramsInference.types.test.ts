// Examples: a loader's and action's `params`/`search` are `Infer` of the route's schemas; a hand-typed shape the
// parsed params do not fit (a renamed or narrower field) does not compile at `manifest` (k.router Manifest, 0086).
import { createCtx } from "@keel/ctx";
import { type Id, type Infer, ok, s } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { action } from "../src/action.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";

const TodoParams = s.object({ todoId: s.id("Todo") });
const Filter = s.object({ filter: s.enum(["all", "done"]).optional() });
const Out = s.object({ id: s.id("Todo") });
const page = (): Node => document.createTextNode("");

const load = loader(
  Out,
  async ({ params }: { readonly params: Infer<typeof TodoParams>; readonly search: Infer<typeof Filter> }) =>
    ok({ id: params.todoId }),
);
const save = action(s.object({}), (_input, { params }: { readonly params: Infer<typeof TodoParams> }) =>
  ok(params.todoId === "" ? null : null),
);
const handTyped = loader(Out, async ({ params }: { readonly params: { readonly id: string } }) =>
  ok({ id: s.id("Todo").parse(params.id).ok ? "t1" : "t2" }),
);
const unread = loader(Out, async () => ok({ id: "t1" }));

const good = { "t.show": { path: "/t/:todoId", params: TodoParams, search: Filter, loader: load, component: page } };
const acts = { "t.edit": { path: "/t/:todoId", params: TodoParams, actions: { POST: save }, component: page } };
const unreadRoute = { "t.any": { path: "/t/:todoId", params: TodoParams, loader: unread, component: page } };
const hand = { "t.bad": { path: "/t/:todoId", params: TodoParams, loader: handTyped, component: page } };
const handAction = action(s.object({}), (_input, { params }: { readonly params: { readonly todoId: number } }) =>
  ok(params.todoId > 0 ? null : null),
);
const handActs = {
  "t.bad": { path: "/t/:todoId", params: TodoParams, actions: { POST: handAction }, component: page },
};
/** What `manifest` accepts for routes `M`: `M` itself when every loader/action fits, else not. */
type Arg<M extends Readonly<Record<string, RouteDef>>> = Parameters<typeof manifest<M>>[0];

describe("loader and action params/search", () => {
  it("are the Infer of the route's schemas: branded ids, no re-parse", () => {
    expectTypeOf(load.run).parameter(0).toEqualTypeOf<{
      readonly params: { todoId: Id<"Todo"> };
      readonly search: { filter?: "all" | "done" | undefined };
    }>();
    expectTypeOf(save.run).parameter(1).toEqualTypeOf<{ readonly params: { todoId: Id<"Todo"> } }>();
    expectTypeOf(unread.run).parameter(0).toEqualTypeOf<{ readonly params: unknown; readonly search: unknown }>();
  });

  it("manifest accepts schema-typed or unread loaders/actions", () => {
    expectTypeOf(good).toMatchTypeOf<Arg<typeof good>>();
    expectTypeOf(acts).toMatchTypeOf<Arg<typeof acts>>();
    expectTypeOf(unreadRoute).toMatchTypeOf<Arg<typeof unreadRoute>>();
  });

  it("manifest rejects a hand-typed loader or action params shape", () => {
    expectTypeOf(hand).not.toMatchTypeOf<Arg<typeof hand>>();
    expectTypeOf(handActs).not.toMatchTypeOf<Arg<typeof handActs>>();
  });

  it("a schema-typed loader runs with the router's parsed params", async () => {
    const routes = manifest(good);
    const params = TodoParams.parse({ todoId: "t9" });
    expect(params.ok).toBe(true);
    if (!params.ok) return;
    const r = await routes.routes["t.show"].loader.run(
      { params: params.value, search: {} },
      createCtx({ mode: "sim" }),
    );
    expect(r).toEqual({ ok: true, value: { id: "t9" } });
  });
});
