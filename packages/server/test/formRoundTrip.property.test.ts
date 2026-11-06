// @vitest-environment happy-dom
// Property (seed 1337): FormData built from any valid input reaches the action equal to that input, for every
// verb (native method or POST with `_method`); runtime gets `ok(null)` JSON, documents get 303.
import { createCtx } from "@keel/ctx";
import { type Verb, action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const BASE = "http://localhost";

const Input = s.object({
  kind: s.enum(["open", "closed"]),
  note: s.string({ min: 1, max: 40 }),
  count: s.int({ min: -1000, max: 1000 }),
  rush: s.boolean(),
  tag: s.string().optional(),
});
type In = { kind: "open" | "closed"; note: string; count: number; rush: boolean; tag?: string };

const input: fc.Arbitrary<In> = fc
  .record({
    kind: fc.constantFrom("open" as const, "closed" as const),
    note: fc.string({ minLength: 1, maxLength: 40 }),
    count: fc.integer({ min: -1000, max: 1000 }),
    rush: fc.boolean(),
    tag: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
  })
  .map(({ tag, ...rest }) => (tag === undefined ? rest : { ...rest, tag }));

const toForm = (v: In): FormData => {
  const fd = new FormData();
  fd.set("kind", v.kind);
  fd.set("note", v.note);
  fd.set("count", String(v.count));
  fd.set("rush", String(v.rush));
  if (v.tag !== undefined) fd.set("tag", v.tag);
  return fd;
};

async function build() {
  const seen: unknown[] = [];
  const act = action(Input, (v) => {
    seen.push(v);
    return ok(null);
  });
  const routes = manifest({
    "orders.edit": {
      path: "/orders/edit",
      actions: { POST: act, PUT: act, PATCH: act, DELETE: act },
      component: () => document.createElement("p"),
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "production",
  });
  return { app, seen };
}

const verbs: Verb[] = ["POST", "PUT", "PATCH", "DELETE"];

describe("FormData round trip through an action (property)", () => {
  it("the action receives the submitted value, by native verb or `_method`", async () => {
    const { app, seen } = await build();
    await fc.assert(
      fc.asyncProperty(
        input,
        fc.constantFrom(...verbs),
        fc.boolean(),
        fc.boolean(),
        async (v, verb, native, runtime) => {
          seen.length = 0;
          const fd = toForm(v);
          if (!native) fd.set("_method", verb.toLowerCase());
          const headers: Record<string, string> = runtime ? { accept: "application/json" } : {};
          const res = await app.fetch(
            new Request(`${BASE}/orders/edit?x=1`, { method: native ? verb : "POST", body: fd, headers }),
          );
          expect(seen).toEqual([v]);
          if (runtime) {
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true, value: null });
          } else {
            expect(res.status).toBe(303);
            expect(res.headers.get("location")).toBe(`${BASE}/orders/edit?x=1`);
          }
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("an out-of-range count is keel.fields at its path and the action is not called", async () => {
    const { app, seen } = await build();
    await fc.assert(
      fc.asyncProperty(input, fc.integer({ min: 1001, max: 1e6 }), async (v, bad) => {
        seen.length = 0;
        const fd = toForm(v);
        fd.set("count", String(bad));
        const res = await app.fetch(
          new Request(`${BASE}/orders/edit`, { method: "POST", body: fd, headers: { accept: "application/json" } }),
        );
        expect(res.status).toBe(422);
        const body: unknown = await res.json();
        expect(body).toMatchObject({ ok: false, error: { code: "keel.fields", data: { count: expect.any(String) } } });
        expect(seen).toEqual([]);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
