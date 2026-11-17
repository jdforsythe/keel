// Examples: a loader's and action's `params`/`search` are `Infer` of the schemas they declare, which are the route's
// own values (k.server API, RFC 0027); an undeclared schema leaves `unknown`, and a route fitting the loader's types
// (RouteFit) with another schema value still throws E1507 at `manifest`.
import { createCtx } from "@keel/ctx";
import { type Id, type Secret, ok, s } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { action } from "../src/action.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";

const TodoParams = s.object({ todoId: s.id("Todo") });
const Filter = s.object({ filter: s.enum(["all", "done"]).optional() });
const Out = s.object({ id: s.id("Todo") });
const page = (): Node => document.createTextNode("");

const load = loader({ output: Out, params: TodoParams, search: Filter }, async ({ params }) =>
  ok({ id: params.todoId }),
);
const save = action({ input: s.object({}), params: TodoParams }, (_input, { params }) =>
  ok(params.todoId === "" ? null : null),
);
const unread = loader({ output: Out }, async () => ok({ id: "t1" }));
// A hand annotation narrower than the declared (or absent) schema does not fit `Run`; asserted below through the
// `unknown` params of `unread` and the type of `save` (suppression comments are not allowed outside unsafe/).

const good = { "t.show": { path: "/t/:todoId", params: TodoParams, search: Filter, loader: load, component: page } };
const acts = { "t.edit": { path: "/t/:todoId", params: TodoParams, component: page } };
const inEntry = { "t.edit": { path: "/t/:todoId", params: TodoParams, actions: { POST: save }, component: page } };
const unreadRoute = { "t.any": { path: "/t/:todoId", params: TodoParams, loader: unread, component: page } };
const Narrower = s.object({ id: s.string() });
const narrow = { "t.bad": { path: "/t/:id", params: Narrower, loader: load, component: page } };
/** What `manifest` accepts for routes `M`: `M` itself when every loader/action fits, else not. */
type Arg<M extends Readonly<Record<string, RouteDef>>> = Parameters<typeof manifest<M>>[0];

describe("loader and action params/search", () => {
  it("are the Infer of the declared schemas, plus the absolute url: branded ids, no re-parse", () => {
    expectTypeOf(load.run).parameter(0).toEqualTypeOf<{
      readonly params: { todoId: Id<"Todo"> };
      readonly search: { filter?: "all" | "done" | undefined };
      readonly url: string;
      readonly caller: string;
      readonly bearer?: Secret<string>;
      readonly stores: undefined;
    }>();
    expectTypeOf(save.run).parameter(1).toEqualTypeOf<{
      readonly params: { todoId: Id<"Todo"> };
      readonly url: string;
      readonly caller: string;
      readonly stores: undefined;
    }>();
    expectTypeOf(unread.run).parameter(0).toEqualTypeOf<{
      readonly params: unknown;
      readonly search: unknown;
      readonly url: string;
      readonly caller: string;
      readonly bearer?: Secret<string>;
      readonly stores: undefined;
    }>();
  });

  it("manifest accepts the declared schemas' routes and unread loaders; a route whose params do not fit fails", () => {
    expectTypeOf(good).toMatchTypeOf<Arg<typeof good>>();
    expectTypeOf(acts).toMatchTypeOf<Arg<typeof acts>>();
    expectTypeOf(inEntry).not.toMatchTypeOf<Arg<typeof inEntry>>();
    expectTypeOf(manifest(acts).actions).toBeCallableWith({ "t.edit": { POST: save } });
    expectTypeOf(unreadRoute).toMatchTypeOf<Arg<typeof unreadRoute>>();
    expectTypeOf(narrow).not.toMatchTypeOf<Arg<typeof narrow>>();
  });

  it("manifest throws E1507 for a route whose schema value is not the declared one; unread loaders pass", () => {
    const Same = s.object({ todoId: s.id("Todo") });
    expect(() =>
      manifest({ "t.x": { path: "/t/:todoId", params: Same, search: Filter, loader: load, component: page } }),
    ).toThrow(/^E1507 t\.x: loader params/);
    expect(() =>
      manifest({ "t.y": { path: "/t/:todoId", params: TodoParams, loader: load, component: page } }),
    ).toThrow(/^E1507 t\.y: loader search/);
    const z = manifest({ "t.z": { path: "/t/:todoId", params: Same, component: page } });
    expect(() => z.actions({ "t.z": { PUT: save } })).toThrow(/^E1507 t\.z: PUT action params/);
    expect(() => manifest(unreadRoute)).not.toThrow();
  });

  it("a loader runs with the router's parsed params and the url", async () => {
    const routes = manifest(good);
    const params = TodoParams.parse({ todoId: "t9" });
    expect(params.ok).toBe(true);
    if (!params.ok) return;
    const r = await routes.routes["t.show"].loader.run(
      { params: params.value, search: {}, url: "http://localhost/t/t9", caller: "", stores: undefined },
      createCtx({ mode: "sim" }),
    );
    expect(r).toEqual({ ok: true, value: { id: "t9" } });
  });
});
