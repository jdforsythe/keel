// @vitest-environment happy-dom
// Examples and properties (seed 1337): the dev log stream writes exactly one `req` record per request (after any
// `diag`); json lines parse. Requests cover every branch of the flow (308, 404s, 405s, guards, actions).
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type LogSink, createApp, topology } from "../src/index.ts";

const SEED = 1337;
const BASE = "http://localhost";
const Page = s.object({ title: s.string() });
const Note = s.object({ note: s.string({ min: 2 }) });

async function build(format: LogSink["format"], lines: string[]) {
  const deny = guard({ redirect: "orders.list" }, () =>
    Promise.resolve(err({ code: "keel.denied", message: "no", data: {} })),
  );
  const broken = guard({ redirect: "orders.list" }, () => Promise.reject(new Error("down")));
  const c = contract("orders", {
    "orders.list": { path: "/orders" },
    "orders.show": { path: "/orders/:id", params: s.object({ id: s.int({ min: 1 }) }) },
    "orders.bad": { path: "/bad" },
    "orders.deny": { path: "/deny" },
    "orders.broken": { path: "/broken" },
  });
  const show = loader(c, "orders.show", { output: Page }, () => Promise.resolve(ok({ title: "T" })));
  const bad = loader(c, "orders.bad", { output: Page }, () => Promise.resolve(ok(JSON.parse('{"title":1}'))));
  const post = action(c, "orders.show", { input: Note }, () => ok(c.href("orders.list")));
  const put = action(c, "orders.show", { input: Note }, () =>
    err({ code: "orders.locked", message: "locked", data: {} }),
  );
  const routes = manifest(c, {
    "orders.list": { component: () => document.createElement("p") },
    "orders.show": {
      loader: show,
      component: () => document.createElement("p"),
      errorElement: ({ error }) => {
        const e = document.createElement("em");
        e.textContent = error.code;
        return e;
      },
      POST: post,
      PUT: put,
    },
    "orders.bad": { loader: bad, component: () => document.createElement("p") },
    "orders.deny": { guard: deny, component: () => document.createElement("p") },
    "orders.broken": { guard: broken, component: () => document.createElement("p") },
  });
  return createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    log: { format, write: (l) => void lines.push(l) },
  });
}

type Call = { method: string; path: string; form?: Record<string, string>; json?: boolean };
const req = (c: Call): Request => {
  const headers: Record<string, string> = c.json === true ? { accept: "application/json" } : {};
  if (c.form === undefined) return new Request(`${BASE}${c.path}`, { method: c.method, headers });
  const fd = new FormData();
  for (const [k, v] of Object.entries(c.form)) fd.set(k, v);
  return new Request(`${BASE}${c.path}`, { method: c.method, body: fd, headers });
};

const calls: fc.Arbitrary<Call> = fc.record({
  method: fc.constantFrom("GET", "HEAD", "OPTIONS"),
  path: fc.constantFrom(
    "/orders/7",
    "/orders/x",
    "/orders/7/",
    "/nope",
    "/nope/",
    "/bad",
    "/deny",
    "/broken",
    "/ghost",
  ),
  json: fc.boolean(),
});
const writes: fc.Arbitrary<Call> = fc.record({
  method: fc.constantFrom("POST", "PUT", "DELETE"),
  path: fc.constantFrom("/orders/7", "/orders", "/deny"),
  form: fc.constantFrom({ note: "ok!" }, { note: "x" }, { note: "ok!", _method: "PUT" }),
  json: fc.boolean(),
});

describe("dev log stream", () => {
  it("one req record per request, nothing else but E1554 and guard-throw diags; in json mode every line parses", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.oneof(calls, writes), { minLength: 1, maxLength: 8 }), async (cs) => {
        const lines: string[] = [];
        const app = await build("json", lines);
        const statuses: number[] = [];
        for (const c of cs) statuses.push((await app.fetch(req(c))).status);
        const records: unknown[] = lines.map((l) => JSON.parse(l));
        const kind = (r: unknown): unknown => (typeof r === "object" && r !== null && "kind" in r ? r.kind : null);
        const reqs = records.filter((r) => kind(r) === "req");
        const diags = records.filter((r) => kind(r) === "diag");
        // E1554 for `/bad`'s loader, and a `keel.unexpected` diag for `/broken`'s throwing guard (k.server Log).
        const bad = cs.filter((c) => (c.path === "/bad" || c.path === "/broken") && c.method !== "OPTIONS").length;
        expect(reqs.length).toBe(cs.length);
        expect(diags.length).toBe(bad);
        expect(records.length).toBe(cs.length + bad);
        reqs.forEach((r, i) => expect(r).toMatchObject({ method: cs[i]?.method, status: statuses[i] }));
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("compact records match OUTPUT.md; E1554 emits a diag before its req", async () => {
    const lines: string[] = [];
    const app = await build("compact", lines);
    await app.fetch(new Request(`${BASE}/orders/7`));
    await app.fetch(new Request(`${BASE}/nope`));
    await app.fetch(new Request(`${BASE}/bad`));
    expect(lines).toEqual([
      "GET /orders/7 orders.show 200 0ms",
      "GET /nope 404 0ms",
      "E1554 loader orders.bad data fails its output schema at title",
      "GET /bad orders.bad 500 0ms",
    ]);
  });

  it("flow edges: 308, runtime 404s, guard errors, unknown guard, action results", async () => {
    const app = await build("compact", []);
    const slash = await app.fetch(req({ method: "GET", path: "/orders//" }));
    expect(slash.status).toBe(308);
    expect(slash.headers.get("location")).toBe("/orders");
    const q = await app.fetch(req({ method: "GET", path: "/orders/7/?a=1" }));
    expect(q.headers.get("location")).toBe("/orders/7?a=1");

    const nf = await app.fetch(req({ method: "GET", path: "/nope", json: true }));
    expect(nf.status).toBe(404);
    expect(await nf.json()).toEqual({
      ok: false,
      error: { code: "keel.notFound", message: "keel.notFound", data: { url: "/nope" } },
    });
    const pf = await app.fetch(req({ method: "GET", path: "/orders/x?t=1", json: true }));
    expect(pf.status).toBe(404);
    expect(await pf.json()).toMatchObject({ ok: false, error: { data: { url: "/orders/x?t=1" } } });
    const pfDoc = await app.fetch(req({ method: "GET", path: "/orders/0" }));
    expect(pfDoc.status).toBe(404);
    expect(await pfDoc.text()).toContain("<main><em>keel.notFound</em></main>");

    const broken = await app.fetch(req({ method: "GET", path: "/broken" }));
    expect(broken.status).toBe(500);
    expect(await broken.text()).toContain('data-keel-error="keel.unexpected">Error: down<');
    const deny = await app.fetch(req({ method: "GET", path: "/deny?x=1" }));
    expect(deny.status).toBe(302);
    expect(deny.headers.get("location")).toBe("/orders?next=%2Fdeny%3Fx%3D1");

    const go = await app.fetch(req({ method: "POST", path: "/orders/7", form: { note: "ok!" }, json: true }));
    expect(await go.json()).toEqual({ ok: true, value: "/orders" });
    const goDoc = await app.fetch(req({ method: "POST", path: "/orders/7", form: { note: "ok!" } }));
    expect(goDoc.status).toBe(303);
    expect(goDoc.headers.get("location")).toBe("/orders");
    const locked = await app.fetch(req({ method: "POST", path: "/orders/7", form: { note: "ok!", _method: "put" } }));
    expect(locked.status).toBe(400);
    expect(await locked.text()).toContain("<em");
    const nope = await app.fetch(req({ method: "PATCH", path: "/orders/7", form: { note: "ok!" } }));
    expect(nope.status).toBe(405);
    expect(nope.headers.get("allow")).toBe("GET, HEAD, POST, PUT");
    const opt = await app.fetch(req({ method: "OPTIONS", path: "/orders/7" }));
    expect(opt.status).toBe(405);
    expect(opt.headers.get("allow")).toBe("GET, HEAD, POST, PUT");
    const noBody = await app.fetch(new Request(`${BASE}/orders/7`, { method: "POST" }));
    expect(noBody.status).toBe(422);
  });
});
