import { readFileSync } from "node:fs";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import { endpoints, service } from "@keel/services";
import { openapi } from "@keel/services/openapi";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { api } from "./fixtures/openapi/api.ts";
// Spec: k.services, clause "The client generated from the OpenAPI fixture has one method per operation, with input and output types matching it."
// seed 1337 (every fast-check run below passes { seed: 1337 }); no wall clock, no Math.random.
// `fixtures/openapi/OrdersApi.schema.ts` and `fixtures/openapi/api.ts` are generated from `fixtures/orders.openapi.json`
// by `openapi(doc, { name: "orders" })` and committed; the first test pins them byte-for-byte.
// UNSPECIFIED (not tested): the decoded value of a 204 with no body under `s.json()`; deleteOrder is served a 200 JSON body.

const here = (p: string): URL => new URL(p, import.meta.url);
const doc: unknown = JSON.parse(readFileSync(here("./fixtures/orders.openapi.json"), "utf8"));

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const operationIds = (d: unknown): string[] => {
  const ids: string[] = [];
  if (!isRecord(d) || !isRecord(d.paths)) return ids;
  for (const item of Object.values(d.paths)) {
    if (!isRecord(item)) continue;
    for (const [m, op] of Object.entries(item)) {
      if (METHODS.includes(m) && isRecord(op) && typeof op.operationId === "string") ids.push(op.operationId);
    }
  }
  return ids;
};

// ---- the equivalent hand-declared client -------------------------------------------------------------
const Status = s.enum(["pending", "paid", "shipped"]);
const Address = s.object({ street: s.string({ min: 1 }), city: s.string(), zip: s.string().optional() });
const Line = s.object({ sku: s.string(), qty: s.int({ min: 1, max: 1000 }) });
const Card = s.object({ cardNumber: s.string() });
const Wire = s.object({ iban: s.string() });
const NewOrder = s.object({
  customer: s.string(),
  lines: s.array(Line),
  shipTo: Address,
  note: s.string().nullable().optional(),
});
const Order = s.object({
  id: s.string(),
  status: Status,
  customer: s.string(),
  lines: s.array(Line),
  shipTo: Address,
  note: s.string().nullable(),
  nickname: s.string().nullable().optional(),
  total: s.number({ min: 0 }),
  paid: s.boolean().optional(),
  meta: s.record(s.string()).optional(),
  flags: s.object({ gift: s.boolean().optional() }, { closed: true }).optional(),
  payment: s.union([Card, Wire]).optional(),
});
const NotFound = s.object({ message: s.string() });
const Conflict = s.object({ reason: s.enum(["stale", "duplicate"]), current: Order.optional() });
const IdParams = s.object({ id: s.string() });
const ListOut = s.object({ items: s.array(Order), next: s.string().nullable().optional() });
const NoteOut = s.object({ text: s.string({ max: 200 }) });
const PatchBody = s.object({
  note: s.string().nullable().optional(),
  flags: s.object({ gift: s.boolean().optional(), rush: s.boolean().optional() }, { closed: true }).optional(),
});

const expectedSchema = endpoints({
  listOrders: {
    method: "GET",
    path: "/orders",
    query: s.object({
      customer: s.string({ min: 1 }),
      status: Status.optional(),
      limit: s.int({ min: 1, max: 100 }).optional(),
    }),
    output: ListOut,
  },
  createOrder: { method: "POST", path: "/orders", body: NewOrder, output: Order, errors: { 409: Conflict } },
  getOrder: {
    method: "GET",
    path: "/orders/:id",
    params: IdParams,
    query: s.object({ expand: s.boolean().optional() }),
    output: Order,
    errors: { 404: NotFound },
  },
  replaceOrder: {
    method: "PUT",
    path: "/orders/:id",
    params: IdParams,
    body: NewOrder,
    output: Order,
    errors: { 404: NotFound },
  },
  patchOrder: {
    method: "PATCH",
    path: "/orders/:id",
    params: IdParams,
    body: PatchBody,
    output: Order,
    errors: { 409: Conflict },
  },
  deleteOrder: {
    method: "DELETE",
    path: "/orders/:id",
    params: IdParams,
    query: s.object({ force: s.boolean() }),
    output: s.json(),
    errors: { 404: NotFound },
  },
  getNote: {
    method: "GET",
    path: "/orders/:id/notes/:noteId",
    params: s.object({ id: s.string(), noteId: s.int() }),
    output: NoteOut,
  },
});
const BASE = "https://api.example.com";
const expected = service({ base: BASE, schema: expectedSchema });

describe("k.services: the client generated from the OpenAPI fixture", () => {
  it("openapi(doc, { name }) is ok and its schema and service sources equal the committed generated files byte-for-byte", () => {
    const r = openapi(doc, { name: "orders" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schema).toBe(readFileSync(here("./fixtures/openapi/OrdersApi.schema.ts"), "utf8"));
    expect(r.value.service).toBe(readFileSync(here("./fixtures/openapi/api.ts"), "utf8"));
  });

  it("has one method per operation: its own keys equal exactly the fixture's operationIds", () => {
    const ids = operationIds(doc);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(api).sort()).toEqual([...ids].sort());
    for (const k of Object.keys(api)) expect(typeof Reflect.get(api, k)).toBe("function");
    expect(Object.keys(expected).sort()).toEqual([...ids].sort());
  });

  it("has input and output types matching the fixture for every operation", () => {
    expectTypeOf<Parameters<typeof api.listOrders>[0]>().toEqualTypeOf<Parameters<typeof expected.listOrders>[0]>();
    expectTypeOf<Awaited<ReturnType<typeof api.listOrders>>>().toEqualTypeOf<
      Awaited<ReturnType<typeof expected.listOrders>>
    >();
    expectTypeOf<Parameters<typeof api.createOrder>[0]>().toEqualTypeOf<Parameters<typeof expected.createOrder>[0]>();
    expectTypeOf<Awaited<ReturnType<typeof api.createOrder>>>().toEqualTypeOf<
      Awaited<ReturnType<typeof expected.createOrder>>
    >();
    expectTypeOf<Parameters<typeof api.getOrder>[0]>().toEqualTypeOf<Parameters<typeof expected.getOrder>[0]>();
    expectTypeOf<Awaited<ReturnType<typeof api.getOrder>>>().toEqualTypeOf<
      Awaited<ReturnType<typeof expected.getOrder>>
    >();
    expectTypeOf<Parameters<typeof api.replaceOrder>[0]>().toEqualTypeOf<Parameters<typeof expected.replaceOrder>[0]>();
    expectTypeOf<Awaited<ReturnType<typeof api.replaceOrder>>>().toEqualTypeOf<
      Awaited<ReturnType<typeof expected.replaceOrder>>
    >();
    expectTypeOf<Parameters<typeof api.patchOrder>[0]>().toEqualTypeOf<Parameters<typeof expected.patchOrder>[0]>();
    expectTypeOf<Awaited<ReturnType<typeof api.patchOrder>>>().toEqualTypeOf<
      Awaited<ReturnType<typeof expected.patchOrder>>
    >();
    expectTypeOf<Parameters<typeof api.deleteOrder>[0]>().toEqualTypeOf<Parameters<typeof expected.deleteOrder>[0]>();
    expectTypeOf<Awaited<ReturnType<typeof api.deleteOrder>>>().toEqualTypeOf<
      Awaited<ReturnType<typeof expected.deleteOrder>>
    >();
    expectTypeOf<Parameters<typeof api.getNote>[0]>().toEqualTypeOf<Parameters<typeof expected.getNote>[0]>();
    expectTypeOf<Awaited<ReturnType<typeof api.getNote>>>().toEqualTypeOf<
      Awaited<ReturnType<typeof expected.getNote>>
    >();
  });

  // ---- runtime: each operation, through ctx.net.route under sim ------------------------------------
  const ID = "o 1";
  const encId = "o%201";
  const order = (): {
    customer: string;
    lines: { sku: string; qty: number }[];
    shipTo: { street: string; city: string };
  } => ({
    customer: "c1",
    lines: [{ sku: "k", qty: 2 }],
    shipTo: { street: "1 Main", city: "X" },
  });
  type Case = {
    readonly method: string;
    readonly path: string;
    readonly okStatus: number;
    readonly outArb: fc.Arbitrary<unknown>;
    readonly errStatus?: number;
    readonly errArb?: fc.Arbitrary<unknown>;
    readonly call: (ctx: SimCtx) => Promise<{ ok: boolean; value?: unknown; error?: unknown }>;
  };

  const run = async (c: Case, mode: "ok" | "err"): Promise<void> => {
    const arb = mode === "ok" ? c.outArb : c.errArb;
    if (arb === undefined) return;
    await fc.assert(
      fc.asyncProperty(arb, async (generated) => {
        const text = JSON.stringify(generated);
        const status = mode === "ok" ? c.okStatus : (c.errStatus ?? 0);
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const seen: { method: string; pathname: string }[] = [];
        ctx.net.route(`${BASE}/*`, async (req) => {
          seen.push({ method: req.method, pathname: new URL(req.url).pathname });
          return new Response(text, { status, headers: { "content-type": "application/json" } });
        });
        const r = await c.call(ctx);
        expect(seen).toEqual([{ method: c.method, pathname: c.path }]);
        if (mode === "ok") {
          expect(r.ok).toBe(true);
          expect(r.value).toEqual(JSON.parse(text));
        } else {
          expect(r.ok).toBe(false);
          expect(r.error).toMatchObject({ code: "api.status", data: { status, body: JSON.parse(text) } });
        }
      }),
      { seed: 1337, numRuns: 25 },
    );
  };
  const cases: Record<string, Case> = {
    listOrders: {
      method: "GET",
      path: "/orders",
      okStatus: 200,
      outArb: gen(ListOut),
      call: (ctx) => api.listOrders({ query: { customer: "c1", limit: 5 } }, ctx),
    },
    createOrder: {
      method: "POST",
      path: "/orders",
      okStatus: 201,
      outArb: gen(Order),
      errStatus: 409,
      errArb: gen(Conflict),
      call: (ctx) => api.createOrder({ body: order() }, ctx),
    },
    getOrder: {
      method: "GET",
      path: `/orders/${encId}`,
      okStatus: 200,
      outArb: gen(Order),
      errStatus: 404,
      errArb: gen(NotFound),
      call: (ctx) => api.getOrder({ params: { id: ID }, query: { expand: true } }, ctx),
    },
    replaceOrder: {
      method: "PUT",
      path: `/orders/${encId}`,
      okStatus: 200,
      outArb: gen(Order),
      errStatus: 404,
      errArb: gen(NotFound),
      call: (ctx) => api.replaceOrder({ params: { id: ID }, body: order() }, ctx),
    },
    patchOrder: {
      method: "PATCH",
      path: `/orders/${encId}`,
      okStatus: 200,
      outArb: gen(Order),
      errStatus: 409,
      errArb: gen(Conflict),
      call: (ctx) => api.patchOrder({ params: { id: ID }, body: { note: null, flags: { gift: true } } }, ctx),
    },
    deleteOrder: {
      method: "DELETE",
      path: `/orders/${encId}`,
      okStatus: 200,
      outArb: gen(s.json()),
      errStatus: 404,
      errArb: gen(NotFound),
      call: (ctx) => api.deleteOrder({ params: { id: ID }, query: { force: false } }, ctx),
    },
    getNote: {
      method: "GET",
      path: `/orders/${encId}/notes/7`,
      okStatus: 200,
      outArb: gen(NoteOut),
      call: (ctx) => api.getNote({ params: { id: ID, noteId: 7 } }, ctx),
    },
  };

  it("the runtime cases cover exactly the operations of the fixture", () => {
    expect(Object.keys(cases).sort()).toEqual(operationIds(doc).sort());
  });

  for (const [name, c] of Object.entries(cases)) {
    it(`${name}: a response generated from the output schema decodes ok with the declared method and filled path`, async () => {
      await run(c, "ok");
    });
    if (c.errArb !== undefined) {
      it(`${name}: a declared error status decodes as api.status with the body`, async () => {
        await run(c, "err");
      });
    }
  }

  // ---- subset errors ---------------------------------------------------------------------------------
  const minimal = (): Record<string, unknown> => ({
    openapi: "3.0.3",
    info: { title: "T", version: "1" },
    servers: [{ url: BASE }],
    paths: {
      "/orders": {
        get: {
          operationId: "listOrders",
          responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "string" } } } } },
        },
      },
    },
  });
  const getOp = (d: Record<string, unknown>): object => {
    const paths = d.paths;
    if (!isRecord(paths)) throw new Error("fixture shape");
    const item = paths["/orders"];
    if (!isRecord(item)) throw new Error("fixture shape");
    const op = item.get;
    if (typeof op !== "object" || op === null) throw new Error("fixture shape");
    return op;
  };
  const issuesOf = (d: unknown): readonly { path: readonly (string | number)[] }[] => {
    const r = openapi(d, { name: "orders" });
    expect(r.ok).toBe(false);
    if (r.ok) return [];
    expect(r.error.code).toBe("schema.invalid");
    expect(r.error.data.issues.length).toBeGreaterThan(0);
    return r.error.data.issues;
  };
  const startsWith = (path: readonly (string | number)[], prefix: readonly (string | number)[]): boolean =>
    prefix.every((p, i) => path[i] === p);
  const resolves = (d: unknown, path: readonly (string | number)[]): boolean => {
    let cur: unknown = d;
    for (const p of path) {
      if (cur === null || typeof cur !== "object") return false;
      cur = Reflect.get(cur, p);
      if (cur === undefined) return false;
    }
    return true;
  };

  it("the minimal doc used for the error cases is itself ok", () => {
    expect(openapi(minimal(), { name: "orders" }).ok).toBe(true);
  });

  it("a doc with no `paths` is err schema.invalid with issue paths into the doc", () => {
    const d = minimal();
    Reflect.deleteProperty(d, "paths");
    const issues = issuesOf(d);
    for (const i of issues) expect(i.path.length === 0 || i.path[0] === "paths").toBe(true);
  });

  it("an operation without `operationId` is err schema.invalid at that operation", () => {
    const d = minimal();
    Reflect.deleteProperty(getOp(d), "operationId");
    const issues = issuesOf(d);
    expect(issues.some((i) => startsWith(i.path, ["paths", "/orders", "get"]))).toBe(true);
    for (const i of issues) expect(resolves(d, i.path.slice(0, 3))).toBe(true);
  });

  it("a non-identifier `operationId` is err schema.invalid at that operation", () => {
    for (const bad of ["list-orders", "1st", "a b", ""]) {
      const d = minimal();
      Reflect.set(getOp(d), "operationId", bad);
      const issues = issuesOf(d);
      expect(issues.some((i) => startsWith(i.path, ["paths", "/orders", "get"]))).toBe(true);
    }
  });

  it("a relative server url is err schema.invalid at servers.0", () => {
    const d = minimal();
    Reflect.set(d, "servers", [{ url: "/v1" }]);
    expect(issuesOf(d).some((i) => startsWith(i.path, ["servers", 0]))).toBe(true);
  });

  it("a missing server is err schema.invalid at servers", () => {
    const d = minimal();
    Reflect.deleteProperty(d, "servers");
    expect(issuesOf(d).some((i) => i.path.length === 0 || i.path[0] === "servers")).toBe(true);
  });

  it("a cyclic $ref is err schema.invalid with issue paths into the doc", () => {
    const d = minimal();
    Reflect.set(d, "components", {
      schemas: { Node: { type: "object", properties: { next: { $ref: "#/components/schemas/Node" } } } },
    });
    Reflect.set(getOp(d), "responses", {
      "200": {
        description: "ok",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Node" } } },
      },
    });
    const issues = issuesOf(d);
    for (const i of issues) expect(resolves(d, i.path)).toBe(true);
    expect(issues.some((i) => i.path[0] === "components" || i.path[0] === "paths")).toBe(true);
  });
});
