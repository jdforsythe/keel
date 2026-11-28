// Spec: k.inspect, clause "`GET /__keel/inspect` on a dev `createApp` returns every live store's state and log and the
// `inspect()` graph; in production mode it is the route table's 404."
// Property seed: 1337. Components are never rendered, so no DOM is needed.
import { createCtx } from "@keel/ctx";
import { inspect, scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const BASE = "http://localhost";
const SEED = 1337;

const appContract = contract("app", { "app.home": { path: "/" } });
const build = (mode: "dev" | "production") =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.home": { component: () => document.createElement("main") } }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
  });

const Counter = s.object({ n: s.int() });
const By = s.object({ by: s.int() });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const rec = (v: unknown): Record<string, unknown> => {
  if (!isRecord(v)) throw new Error("not a record");
  return v;
};

/** A graph's nodes and edges as canonical JSON strings, for set comparison. */
const parts = (g: unknown): { nodes: string[]; edges: string[] } => {
  const r = rec(g);
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => JSON.stringify(x)) : []);
  expect(Array.isArray(r.nodes)).toBe(true);
  expect(Array.isArray(r.edges)).toBe(true);
  return { nodes: list(r.nodes), edges: list(r.edges) };
};

describe("k.cli GET /__keel/inspect", () => {
  it("`GET /__keel/inspect` on a dev `createApp` returns every live store's state and log and the `inspect()` graph", async () => {
    const app = await build("dev");
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{3,8}$/), { minLength: 1, maxLength: 4 }),
        fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 5 }),
        async (names, bys) => {
          const ids = names.map((n) => `app.${n}`);
          const applied: Record<string, { name: string; payload: { by: number } }[]> = {};
          const sc = scope(
            () => {
              for (const id of ids) {
                const st = store(Counter, { n: 0 }, { id });
                const add = transaction(st, `${id}.add`, By, (state, { by }) => ({ n: state.n + by }));
                applied[id] = [];
                for (const by of bys) {
                  const r = tx(add, { by });
                  expect(r.ok).toBe(true);
                  applied[id]?.push({ name: `${id}.add`, payload: { by } });
                }
              }
            },
            { detached: true },
          );
          try {
            const before = parts(JSON.parse(JSON.stringify(inspect())));
            const res = await app.fetch(new Request(`${BASE}/__keel/inspect`));
            const after = parts(JSON.parse(JSON.stringify(inspect())));
            expect(res.status).toBe(200);
            const doc = rec(await res.json());
            for (const k of ["live", "graph", "stores", "ids", "a11y", "routes"]) expect(doc).toHaveProperty(k);
            // `graph` is inspect() at serving time: every node and edge live before the request, plus only what the
            // request itself created (its own scope), which is gone once the response is returned.
            const served = parts(doc.graph);
            expect(before.nodes.length).toBeGreaterThan(0);
            for (const n of before.nodes) expect(served.nodes).toContain(n);
            for (const e of before.edges) expect(served.edges).toContain(e);
            for (const n of served.nodes) if (!before.nodes.includes(n)) expect(after.nodes).not.toContain(n);
            for (const e of served.edges) if (!before.edges.includes(e)) expect(after.edges).not.toContain(e);
            expect(after).toEqual(before);
            const stores = rec(doc.stores);
            const total = bys.reduce((a, b) => a + b, 0);
            for (const id of ids) {
              const entry = rec(stores[id]);
              expect(entry.state).toEqual({ n: total });
              const log = entry.log;
              expect(Array.isArray(log)).toBe(true);
              const got = Array.isArray(log) ? log.map((e) => ({ name: rec(e).name, payload: rec(e).payload })) : [];
              expect(got).toEqual(applied[id]);
            }
          } finally {
            sc.dispose();
          }
          const after = rec(rec(await (await app.fetch(new Request(`${BASE}/__keel/inspect`))).json()).stores);
          for (const id of ids) expect(after).not.toHaveProperty(id);
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("in production mode `GET /__keel/inspect` is the route table's 404, identical to any unmatched path", async () => {
    const app = await build("production");
    const probe = await app.fetch(new Request(`${BASE}/__keel/inspect`));
    expect(probe.status).toBe(404);
    // A document carries a new nonce per response (k.security Policy); every other byte is equal.
    const sameNonce = (html: string): string => html.replace(/nonce="[^"]*"/g, 'nonce="<nonce>"');
    const body = sameNonce(await probe.text());
    for (const other of ["/__keel/nope", "/no/such/page"]) {
      const o = await app.fetch(new Request(`${BASE}${other}`));
      expect(o.status).toBe(probe.status);
      expect(o.headers.get("content-type")).toBe(probe.headers.get("content-type"));
      expect(sameNonce(await o.text())).toBe(body);
    }
  });
});
