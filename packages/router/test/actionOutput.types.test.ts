// Examples: an API write entry's action answers its data, the entry's `output`, and gets `bearer`; a page's action
// declares no `output` and answers navigation (k.api Output, Bearer); `manifest` refuses either on the other kind (E1515).
import { createCtx } from "@keel/ctx";
import { type Secret, ok, s } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { manifest } from "../src/manifest.ts";
import type { Action } from "../src/types/Action.ts";
import type { ApiAction } from "../src/types/ApiAction.ts";

const N = s.object({ n: s.int() });
const page = (): Node => document.createTextNode("");
const seen: unknown[] = [];
const c = contract("t", {
  "t.reports": { method: "POST", path: "/api/reports", output: N },
  "t.nothing": { method: "DELETE", path: "/api/nothing", output: s.object({}) },
  "t.index": { path: "/" },
});
const apiAct = action(c, "t.reports", {}, async (_body, at) => {
  expectTypeOf(at.bearer).toEqualTypeOf<Secret<string> | undefined>();
  seen.push(Object.hasOwn(at, "bearer") ? at.bearer : "absent");
  return ok({ n: 1 });
});
const pageAct = action(c, "t.index", { input: s.object({}) }, async (_input, at) => {
  expectTypeOf<keyof typeof at>().toEqualTypeOf<"params" | "url" | "caller" | "user" | "stores" | "routes">();
  return ok(null);
});
const nothing = action(c, "t.nothing", {}, async () => ok({}));

describe("action overloads", () => {
  it("on an API write entry it is an ApiAction answering the entry's output; on a page, an Action answering Href | null", () => {
    expectTypeOf(apiAct).toEqualTypeOf<ApiAction<"t.reports", { n: number }>>();
    expectTypeOf(pageAct).toEqualTypeOf<Action<"t.index">>();
    expectTypeOf(pageAct.output).toEqualTypeOf<undefined>();
    expect(pageAct.output).toBeUndefined();
    expect(apiAct.output.node).toEqual(N.node);
    expect(nothing.output.node).toEqual(s.object({}).node);
  });

  it("an API action's fn returning a link does not fit the entry's output; a page action's returning data does not either", () => {
    // Type-only: negativeTypes.test-d.ts holds both refusals.
    expect(true).toBe(true);
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
  });
});

describe("binding an action to the other kind (E1515)", () => {
  const bind = (binding: Record<string, unknown>): unknown => Reflect.apply(manifest, undefined, [c, binding]);
  const code = (f: () => unknown): unknown => {
    try {
      f();
    } catch (e) {
      return e instanceof Error ? [Reflect.get(e, "code"), e.message] : e;
    }
    return null;
  };
  const rest = { "t.nothing": { action: nothing } };

  it("an API entry takes its output action and a page its input action; the other way fails", () => {
    expect(
      code(() => bind({ ...rest, "t.reports": { action: apiAct }, "t.index": { component: page, POST: pageAct } })),
    ).toBeNull();
    expect(code(() => bind({ ...rest, "t.reports": { action: pageAct }, "t.index": { component: page } }))).toEqual([
      "E1515",
      "E1515 t.reports: action is not an action declared for t.reports",
    ]);
    expect(
      code(() => bind({ ...rest, "t.reports": { action: apiAct }, "t.index": { component: page, DELETE: apiAct } })),
    ).toEqual(["E1515", "E1515 t.index: DELETE is not an action declared for t.index"]);
  });

  it("an action for a page bound at an API entry does not compile and throws", () => {
    // The type error is in negativeTypes.test-d.ts; called untyped here.
    const bad = () =>
      Reflect.apply(manifest, undefined, [
        c,
        { "t.reports": { action: pageAct }, "t.nothing": { action: nothing }, "t.index": { component: page } },
      ]);
    expect(bad).toThrow(/^E1515/);
  });
});
