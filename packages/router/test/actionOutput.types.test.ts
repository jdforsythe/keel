// Examples: an API route's action declares `output` and answers its data, gets `bearer`; a page's action declares no
// `output` and answers navigation (k.api Output, Bearer); `routes.actions` refuses either on the other kind (E1512).
import { createCtx } from "@keel/ctx";
import { type KeelError, type Result, type Secret, ok, s } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { action } from "../src/action.ts";
import { manifest } from "../src/manifest.ts";
import type { Action } from "../src/types/Action.ts";
import type { ActionsFit } from "../src/types/ActionsFit.ts";
import type { ApiAction } from "../src/types/ApiAction.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";

type None = Record<never, never>;
const N = s.object({ n: s.int() });
const page = (): Node => document.createTextNode("");
const seen: unknown[] = [];
const apiAct = action({ input: s.object({}), output: N }, async (_input, at) => {
  expectTypeOf(at.bearer).toEqualTypeOf<Secret<string> | undefined>();
  seen.push(Object.hasOwn(at, "bearer") ? at.bearer : "absent");
  return ok({ n: 1 });
});
const pageAct = action({ input: s.object({}) }, async (_input, at) => {
  expectTypeOf<keyof typeof at>().toEqualTypeOf<"params" | "url" | "caller" | "user" | "stores">();
  return ok(null);
});
const nothing = action({ input: s.object({}), output: s.object({}) }, async () => ok({}));
/** `fn` of the API overload for input `{}` and output `{ n: number }`. */
type ApiFn = Parameters<typeof action<None, { n: number }, unknown, undefined>>[1];
type Fit<A> = ActionsFit<typeof m.routes, A>;

const m = manifest({
  "api.reports": { api: true, path: "/api/reports" },
  "todos.index": { path: "/", component: page },
});

describe("action overloads", () => {
  it("with output it is an ApiAction answering the output's type; without, an Action answering Href | null", () => {
    expectTypeOf(apiAct).toEqualTypeOf<ApiAction<None, { n: number }, unknown, undefined>>();
    expectTypeOf(pageAct).toEqualTypeOf<Action<None, unknown, undefined>>();
    expectTypeOf(pageAct.output).toEqualTypeOf<undefined>();
    expectTypeOf(apiAct.run).returns.toEqualTypeOf<
      Result<{ n: number }, KeelError<string, unknown>> | Promise<Result<{ n: number }, KeelError<string, unknown>>>
    >();
    expectTypeOf(apiAct.run).parameter(1).toEqualTypeOf<{
      readonly params: unknown;
      readonly url: string;
      readonly caller: string;
      readonly user?: string;
      readonly stores: undefined;
      readonly bearer?: Secret<string>;
    }>();
  });

  it("an output action's fn returning a link for an object output does not fit; the output's value does", () => {
    const toHref = () => ok(m.href("todos.index"));
    const toN = () => ok({ n: 1 });
    expectTypeOf(toHref).not.toExtend<ApiFn>();
    expectTypeOf(toN).toExtend<ApiFn>();
  });

  it("run passes bearer to fn, as undefined when a direct caller leaves it out", async () => {
    const ctx = createCtx({ seed: 1 });
    const at = { params: undefined, url: "https://x.test/api/reports", caller: "", stores: undefined };
    seen.length = 0;
    expect(await apiAct.run({}, at, ctx)).toEqual(ok({ n: 1 }));
    const bearer = s.secret(s.string()).parse("abc");
    expect(bearer.ok).toBe(true);
    if (bearer.ok) await apiAct.run({}, { ...at, bearer: bearer.value }, ctx);
    expect(seen).toEqual([undefined, bearer.ok ? bearer.value : null]);
    expect(nothing.output.node).toEqual(s.object({}).node);
  });
});

describe("ActionsFit and routes.actions (E1512)", () => {
  it("an API route takes an output action and a page an action without; the other way fails with the message", () => {
    expectTypeOf<Fit<{ "api.reports": { POST: typeof apiAct } }>["api.reports"]["POST"]>().toEqualTypeOf<unknown>();
    expectTypeOf<Fit<{ "todos.index": { POST: typeof pageAct } }>["todos.index"]["POST"]>().toEqualTypeOf<unknown>();
    expectTypeOf<
      Fit<{ "api.reports": { POST: typeof pageAct } }>["api.reports"]["POST"]
    >().toEqualTypeOf<"E1512 api.reports: an API route's action declares output (POST)">();
    expectTypeOf<
      Fit<{ "todos.index": { PUT: typeof apiAct } }>["todos.index"]["PUT"]
    >().toEqualTypeOf<"E1512 todos.index: a page's action declares no output (PUT)">();
    expectTypeOf(m.actions).toBeCallableWith({ "api.reports": { POST: apiAct }, "todos.index": { POST: pageAct } });
  });

  it("routes.actions over an untyped table throws E1512 for either binding and attaches nothing", () => {
    const table = (): Record<string, RouteDef> => ({
      "api.reports": { api: true, path: "/api/reports" },
      "todos.index": { path: "/", component: page },
    });
    const code = (f: () => void): unknown => {
      try {
        f();
      } catch (e) {
        return e instanceof Error ? [Reflect.get(e, "code"), e.message] : e;
      }
      return null;
    };
    const a = manifest(table());
    expect(code(() => a.actions({ "todos.index": { POST: pageAct }, "api.reports": { POST: pageAct } }))).toEqual([
      "E1512",
      "E1512 api.reports: an API route's action declares output (POST)",
    ]);
    expect(code(() => a.actions({ "todos.index": { POST: pageAct } }))).toBeNull();
    const b = manifest(table());
    expect(code(() => b.actions({ "todos.index": { DELETE: apiAct } }))).toEqual([
      "E1512",
      "E1512 todos.index: a page's action declares no output (DELETE)",
    ]);
    expect(code(() => b.actions({ "api.reports": { POST: apiAct }, "todos.index": { POST: pageAct } }))).toBeNull();
  });
});
