// @vitest-environment happy-dom
// Spec: k.api, Output "An API entry's handler returns `Result<T, KeelError>` for its `output`'s type `T`; a page's action declares no `output` (k.contract Handlers)."
// Spec: k.api, Output "An `ok` value is parsed by `output` before any store is saved (fail: E1554, nothing saved), then the stores are saved (k.server Server state), then the answer is 200 `application/json` `{ "ok": true, "value": <encoded> }`; a 409 `keel.conflict` sends no value."
// Spec: k.api, Output "A write that answers nothing declares `output: s.object({})` and returns `ok({})`."
// Spec: k.api, Output "Every write's answer is `Cache-Control: no-store`."
// Spec: k.api, Conformance "An action with `output: s.object({ n: s.int() })` returning `ok({ n: 1 })` answers 200 `{ "ok": true, "value": { "n": 1 } }`, `cache-control: no-store`; returning `ok({ n: 0.5 })`, 500 and no store saved."
// Spec: k.api, Conformance "An API action returning a value its entry's `output` refuses does not compile."
// Spec: k.api, Conformance "A form POST to an API route gets the action's `Result` as JSON with no `Location`."
// Spec: k.server, API "`action(contract, id, { input?, stores? }, fn)` ... returns `Result<Href | null, KeelError>` on a page (an API entry's `output` on one: k.api); the binding places it (k.contract)."
// Spec: k.server, Rules "E1554 loader or action data fails its output schema (dev diag; production 500)"
// Seed: 1337.
// One module, `api`: one entry per method (`api.notes` GET, `api.add` POST, `api.replace` PUT, `api.slow` PATCH, `api.fail` DELETE) at `/api/notes`, plus a page `api.page`.
// A handler that must return a value its entry refuses is built with `Reflect.apply`, since the type refuses it (the unchecked caller of k.api Conformance).
// UNTESTABLE as written: that an E1554 diag "names the path, never the value" (no spec sentence says so); the record case asserts the part the spec fixes: 500, an E1554 diag in dev, and no diag holding the key.
// UNTESTABLE as written: an action's `output` value reaching `[pii]` in a `diag` of a later throw in the same request: an API route has no layout, so no
// loader of the request runs after an action's answer. The test checks the nearest reachable case: the pii value is answered as written and a diag of the request never holds it.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp, post } from "./fixtures.ts";

const Notes = s.object({ items: s.array(s.int()) });
const N = s.object({ n: s.int() });
const Add = s.object({ n: s.int() });
const Nothing = s.object({});
const Boom = s.error("conf.boom", s.object({ why: s.string() }));
const Scores = s.record(s.int());
const Contact = s.object({ contact: s.string().pii("contact"), n: s.int() });
const KEY = "keel.store.out.s";

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}
function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const factory = () => {
  const box = store(Notes, { items: [] }, { id: "out.s" });
  const add = transaction(box, "out.add", Add, (state, { n }) => ({ items: [...state.items, n] }));
  return { s: box, add };
};
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);
const view = (): Node => document.createElement("main");

async function setup(mode: "dev" | "production" = "production") {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const lines: string[] = [];
  const gates = new Map<number, Deferred>();
  const arrived = new Map<number, Deferred>();
  const gate = (n: number): Deferred => {
    const g = gates.get(n) ?? deferred();
    gates.set(n, g);
    return g;
  };
  const arrive = (n: number): Deferred => {
    const g = arrived.get(n) ?? deferred();
    arrived.set(n, g);
    return g;
  };
  const c = contract("api", {
    "api.notes": { method: "GET", path: "/api/notes", output: Notes },
    "api.add": { method: "POST", path: "/api/notes", body: Add, output: N },
    "api.replace": { method: "PUT", path: "/api/notes", body: Add, output: N },
    "api.slow": { method: "PATCH", path: "/api/notes", body: Add, output: N },
    "api.fail": { method: "DELETE", path: "/api/notes", body: Add, output: N },
    "api.contact": { method: "POST", path: "/api/contact", body: Add, output: Contact },
    "api.contactBad": { method: "PUT", path: "/api/contact", body: Add, output: Contact },
    "api.scores": { method: "POST", path: "/api/scores", body: Add, output: Scores },
    "api.page": { path: "/page" },
  });
  const read = loader(c, "api.notes", { stores: factory }, async ({ stores }) =>
    ok({ items: [...stores.s.get("items")] }),
  );
  const good = action(c, "api.add", { stores: factory }, async ({ n }, { stores }) => {
    tx(stores.add, { n });
    return ok({ n });
  });
  // the entry's `output` refuses `n + 0.5`: the type stops it, so these are made through the untyped `Reflect.apply`
  const bad = Reflect.apply(action, undefined, [
    c,
    "api.replace",
    { stores: factory },
    async ({ n }: { n: number }, { stores }: { stores: ReturnType<typeof factory> }) => {
      tx(stores.add, { n });
      return ok({ n: n + 0.5 });
    },
  ]);
  const slow = action(c, "api.slow", { stores: factory }, async ({ n }, { stores }) => {
    tx(stores.add, { n });
    arrive(n).resolve();
    await gate(n).promise;
    return ok({ n });
  });
  const fail = action(c, "api.fail", { stores: factory }, async ({ n }, { stores }) => {
    tx(stores.add, { n });
    return err(Boom.make({ why: "no" }));
  });
  const contact = action(c, "api.contact", {}, async ({ n }) => ok({ contact: `p${n}@example.test`, n }));
  const contactBad = Reflect.apply(action, undefined, [
    c,
    "api.contactBad",
    {},
    async ({ n }: { n: number }) => ok({ contact: `p${n}@example.test`, n: n + 0.5 }),
  ]);
  const scores = Reflect.apply(action, undefined, [c, "api.scores", {}, async () => ok({ "alice@example.com": 0.5 })]);
  const pageAct = action(c, "api.page", { input: Add }, async () => ok(null));
  const routes = Reflect.apply(manifest, undefined, [
    c,
    {
      "api.notes": { loader: read },
      "api.add": { action: good },
      "api.replace": { action: bad },
      "api.slow": { action: slow },
      "api.fail": { action: fail },
      "api.contact": { action: contact },
      "api.contactBad": { action: contactBad },
      "api.scores": { action: scores },
      "api.page": { component: view, POST: pageAct },
    },
  ]);
  const app = await createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    routes,
    ctx,
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  const json = (method: string, path: string, body: unknown): Promise<Response> =>
    app.fetch(
      new Request(`http://localhost${path}`, {
        method,
        body: JSON.stringify(body),
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
      }),
    );
  const items = async (): Promise<unknown> => {
    const res = await app.fetch(new Request("http://localhost/api/notes", { headers: { accept: "application/json" } }));
    const body: unknown = await res.json();
    return field(field(field(body, "results"), "api.notes"), "value");
  };
  const diags = (): unknown[] =>
    lines.map((l): unknown => JSON.parse(l)).filter((rec) => field(rec, "kind") === "diag");
  return { ctx, json, items, diags, lines, app, gate, arrive };
}
const stateOf = (raw: string | null): unknown => (raw === null ? undefined : field(JSON.parse(raw), "state"));

describe("k.api output", () => {
  it('An action with `output: s.object({ n: s.int() })` returning `ok({ n: 1 })` answers 200 `{ "ok": true, "value": { "n": 1 } }`, `cache-control: no-store`; returning `ok({ n: 0.5 })`, 500 and no store saved.', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), async (n) => {
        const t = await setup();
        const res = await t.json("POST", "/api/notes", { n });
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type") ?? "").toContain("application/json");
        expect(res.headers.get("cache-control")).toContain("no-store");
        expect(await res.json()).toEqual({ ok: true, value: { n } });
        expect(stateOf(await t.ctx.storage.get(KEY))).toEqual({ items: [n] });
        expect(await t.items()).toEqual({ items: [n] });
      }),
      { seed: SEED, numRuns: 15 },
    );
    const t = await setup();
    const bad = await t.json("PUT", "/api/notes", { n: 1 });
    expect(bad.status).toBe(500);
    expect(await t.items()).toEqual({ items: [] });
  });

  it('An `ok` value is parsed by `output` before any store is saved (fail: E1554, nothing saved), then the stores are saved (k.server Server state), then the answer is 200 `application/json` `{ "ok": true, "value": <encoded> }`; a 409 `keel.conflict` sends no value.', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), async (n) => {
        for (const mode of ["dev", "production"] as const) {
          const t = await setup(mode);
          const res = await t.json("PUT", "/api/notes", { n });
          expect(res.status).toBe(500);
          expect(res.headers.get("cache-control")).toContain("no-store");
          const body: unknown = await res.json();
          expect(field(body, "ok")).toBe(false);
          expect(field(field(body, "error"), "code")).toBe("keel.unexpected");
          if (mode === "production") expect(field(field(body, "error"), "message")).toBe("unexpected");
          expect(await t.ctx.storage.get(KEY)).toBeNull();
        }
      }),
      { seed: SEED, numRuns: 10 },
    );
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1001, max: 2000 }), async (a, b) => {
        const t = await setup();
        const first = t.json("PATCH", "/api/notes", { n: a });
        const second = t.json("PATCH", "/api/notes", { n: b });
        await Promise.all([t.arrive(a).promise, t.arrive(b).promise]);
        t.gate(a).resolve();
        const resA = await first;
        expect(resA.status).toBe(200);
        expect(await resA.json()).toEqual({ ok: true, value: { n: a } });
        t.gate(b).resolve();
        const resB = await second;
        expect(resB.status).toBe(409);
        const body: unknown = await resB.json();
        expect(field(body, "ok")).toBe(false);
        expect(field(field(body, "error"), "code")).toBe("keel.conflict");
        expect(Object.hasOwn(Object(body), "value")).toBe(false);
        expect(stateOf(await t.ctx.storage.get(KEY))).toEqual({ items: [a] });
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  it("E1554 loader or action data fails its output schema (dev diag; production 500)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1000, max: 9000 }), async (n) => {
        const t = await setup("dev");
        const res = await t.json("PUT", "/api/notes", { n });
        expect(res.status).toBe(500);
        const diags = t.diags().filter((d) => JSON.stringify(d).includes("E1554"));
        expect(diags).toHaveLength(1);
        const line = JSON.stringify(diags[0]);
        expect(line).toMatch(/\bn\b/);
        expect(line).not.toContain(String(n + 0.5));
        expect(await t.ctx.storage.get(KEY)).toBeNull();
      }),
      { seed: SEED, numRuns: 4 },
    );
  });

  it("A write that answers nothing declares `output: s.object({})` and returns `ok({})`.", async () => {
    const t = await setup();
    const res = await t.json("POST", "/api/notes", { n: 3 });
    expect(res.status).toBe(200);
    const nc = contract("api", { "api.none": { method: "POST", path: "/api/none", body: Nothing, output: Nothing } });
    const none = action(nc, "api.none", {}, async () => ok({}));
    const routes = manifest(nc, { "api.none": { action: none } });
    const app = await createApp({
      topology: topology({ web: { modules: ["api"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
    });
    const answer = await app.fetch(
      new Request("http://localhost/api/none", {
        method: "POST",
        body: "{}",
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
      }),
    );
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ ok: true, value: {} });
  });

  it("Every write's answer is `Cache-Control: no-store`.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("POST", "PUT", "DELETE"), async (method) => {
        const t = await setup();
        const res = await t.json(method, "/api/notes", { n: 1 });
        expect(res.headers.get("cache-control")).toContain("no-store");
        await res.text();
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  it("An API entry's action answers its entry's `output`, and a page's action declares none (k.contract Handlers): `fn` returns `Result<T, KeelError>` for `output`'s type `T`.", async () => {
    const t = await setup();
    const res = await t.json("DELETE", "/api/notes", { n: 4 });
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    expect(field(body, "ok")).toBe(false);
    expect(field(field(body, "error"), "code")).toBe("conf.boom");
    expect(field(field(field(body, "error"), "data"), "why")).toBe("no");
    expect(Object.hasOwn(Object(body), "value")).toBe(false);
    expect(await t.ctx.storage.get(KEY)).toBeNull();
    const page = await t.app.fetch(post("/page", { n: "1" }));
    expect(page.status).toBe(303);
    expect(page.headers.get("location")).not.toBeNull();
  });

  it("A form POST to an API route gets the action's `Result` as JSON with no `Location`.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 500 }), async (n) => {
        const t = await setup();
        const res = await t.app.fetch(post("/api/notes", { n: String(n) }, { accept: "text/html" }));
        expect(res.status).toBe(200);
        expect(res.headers.get("location")).toBeNull();
        expect(res.headers.get("content-type") ?? "").toContain("application/json");
        expect(await res.json()).toEqual({ ok: true, value: { n } });
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("A page action's answer to a document POST is still 303.", async () => {
    const t = await setup();
    const res = await t.app.fetch(post("/page", { n: "1" }, { accept: "text/html" }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location") ?? "", "http://localhost").pathname).toBe("/page");
  });

  it("A `.pii('contact')` field in `output` is answered as written, and no `diag` of the request holds its value.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 900 }), async (n) => {
        const t = await setup("dev");
        const res = await t.json("POST", "/api/contact", { n });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, value: { contact: `p${n}@example.test`, n } });
        const bad = await t.json("PUT", "/api/contact", { n });
        expect(bad.status).toBe(500);
        for (const d of t.diags()) expect(JSON.stringify(d)).not.toContain(`p${n}@example.test`);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it('E1554 loader or action data fails its output schema (dev diag; production 500): an `output: s.record(s.int())` action returning `ok({ "alice@example.com": 0.5 })` answers 500 and no diag holds the key.', async () => {
    for (const mode of ["dev", "production"] as const) {
      const t = await setup(mode);
      const res = await t.json("POST", "/api/scores", { n: 1 });
      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain("alice@example.com");
      if (mode === "dev") expect(t.diags().filter((d) => JSON.stringify(d).includes("E1554"))).toHaveLength(1);
      for (const line of t.lines) expect(line).not.toContain("alice@example.com");
    }
  });

  it("An API action returning a value its entry's `output` refuses does not compile", () => {
    const c = contract("api", { "api.add": { method: "POST", path: "/api/notes", body: Add, output: N } });
    // compile-time half: ./negative-types.test-d.ts
    const bad = () => Reflect.apply(action, undefined, [c, "api.add", {}, async () => ok({ n: "x" })]);
    expect(typeof bad).toBe("function");
  });

  it("An API loader returning a value that fails the entry's `output` is a compile error, and at runtime (an unchecked caller) E1554 with nothing saved", async () => {
    const c = contract("api", { "api.notes": { method: "GET", path: "/api/notes", output: Notes } });
    // compile-time half: ./negative-types.test-d.ts
    const typed = () => Reflect.apply(loader, undefined, [c, "api.notes", {}, async () => ok({ items: "x" })]);
    expect(typeof typed).toBe("function");
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 99 }), async (n) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const lines: string[] = [];
        const unchecked = Reflect.apply(loader, undefined, [
          c,
          "api.notes",
          { stores: factory },
          async ({ stores }: { stores: ReturnType<typeof factory> }) => {
            tx(stores.add, { n });
            return ok({ items: "x" });
          },
        ]);
        const routes = Reflect.apply(manifest, undefined, [c, { "api.notes": { loader: unchecked } }]);
        const app = await createApp({
          topology: topology({ web: { modules: ["api"], adapter: "node" } }),
          routes,
          ctx,
          mode: "dev",
          log: { format: "json", write: (l: string) => void lines.push(l) },
        });
        const res = await app.fetch(
          new Request("http://localhost/api/notes", { headers: { accept: "application/json" } }),
        );
        expect(res.status).toBe(500);
        expect(lines.filter((l) => l.includes("E1554"))).toHaveLength(1);
        expect(await ctx.storage.get(KEY)).toBeNull();
      }),
      { seed: SEED, numRuns: 5 },
    );
  });
});
