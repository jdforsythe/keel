// k.server Server state, RFC 0054 (backlog 0148): for any interleaving of overlapping requests that read and write
// random subsets of one factory's stores, the committed actions and every GET form an acyclic multiversion
// serialization graph (no write skew, no read skew: no request observes a mixed cut).
// Seed: 1337 (fc.assert seed below). Storage `get`/`set` and request starts are ordered by `fc.scheduler`.
import { type Ctx, createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const KEYS = ["a", "b", "c"] as const;
type Key = (typeof KEYS)[number];
const V = s.object({ v: s.string() });
const Cut = s.object({ a: s.string(), b: s.string(), c: s.string() });
const Op = s.object({ id: s.string(), reads: s.array(s.string()), writes: s.array(s.string()) });
const INIT = "init";

const isKey = (k: string): k is Key => k === "a" || k === "b" || k === "c";

const factory = () => {
  const make = (k: Key) => {
    const st = store(V, { v: INIT }, { id: `prop.${k}` });
    return { st, set: transaction(st, `prop.set.${k}`, V, (_state, p) => p) };
  };
  return { a: make("a"), b: make("b"), c: make("c") };
};

type Request = { readonly kind: "get" } | { readonly kind: "post"; readonly reads: Key[]; readonly writes: Key[] };

const keySet = fc.subarray([...KEYS]);
const request: fc.Arbitrary<Request> = fc.oneof(
  fc.constant<Request>({ kind: "get" }),
  fc
    .record({ reads: keySet, writes: fc.subarray([...KEYS], { minLength: 1 }) })
    .map((r): Request => ({ kind: "post", ...r })),
);

/** Whether `edges` (from -> to) has a cycle. */
function cycleIn(edges: ReadonlyMap<string, ReadonlySet<string>>): boolean {
  const state = new Map<string, "open" | "done">();
  const visit = (n: string): boolean => {
    const at = state.get(n);
    if (at === "open") return true;
    if (at === "done") return false;
    state.set(n, "open");
    for (const m of edges.get(n) ?? []) if (visit(m)) return true;
    state.set(n, "done");
    return false;
  };
  return [...edges.keys()].some(visit);
}

describe("overlapping requests are serializable (property)", () => {
  it("committed actions and GETs form an acyclic multiversion serialization graph", async () => {
    // Across runs both outcomes occur, so the property is not met by refusing (or by never overlapping).
    const tally = { committed: 0, conflicted: 0 };
    await fc.assert(
      fc.asyncProperty(fc.scheduler(), fc.array(request, { minLength: 2, maxLength: 6 }), async (sch, reqs) => {
        const data = new Map<string, string>();
        // Writers of each key in the order their `set` landed (the key's version order), after INIT.
        const versions = new Map<Key, string[]>(KEYS.map((k) => [k, [INIT]]));
        const base = createCtx({ mode: "sim", seed: 1337 });
        const storage: Ctx["storage"] = {
          get: (key) => sch.schedule(Promise.resolve(data.get(key) ?? null), `get ${key}`),
          set: (key, value) =>
            sch.schedule(Promise.resolve(), `set ${key}`).then(() => {
              data.set(key, value);
              const k = key.slice("keel.store.prop.".length);
              const parsed = s.object({ state: V }).parse(JSON.parse(value));
              if (isKey(k) && parsed.ok) versions.get(k)?.push(parsed.value.state.v);
            }),
        };
        const ctx: Ctx = { clock: base.clock, random: base.random, net: base.net, storage };
        const seen = new Map<string, Partial<Record<Key, string>>>();
        const routes = manifest({
          "app.prop": {
            path: "/prop",
            loader: loader({ output: Cut, stores: factory }, async ({ stores }) =>
              ok({ a: stores.a.st.get("v"), b: stores.b.st.get("v"), c: stores.c.st.get("v") }),
            ),
            component: () => document.createElement("p"),
          },
        });
        routes.actions({
          "app.prop": {
            POST: action({ input: Op, stores: factory }, ({ id, reads, writes }, { stores }) => {
              const saw: Partial<Record<Key, string>> = {};
              for (const k of reads) if (isKey(k)) saw[k] = stores[k].st.get("v");
              seen.set(id, saw);
              for (const k of writes) {
                if (!isKey(k)) continue;
                const r = tx(stores[k].set, { v: id });
                if (!r.ok) return err(r.error);
              }
              return ok(null);
            }),
          },
        });
        const app = await createApp({
          topology: topology({ web: { modules: ["app"], adapter: "node" } }),
          routes,
          ctx,
        });
        const send = async (r: Request, id: string): Promise<{ id: string; status: number; cut: unknown }> => {
          await sch.schedule(Promise.resolve(), `start ${id}`);
          const headers = new Headers({ accept: "application/json" });
          if (r.kind === "get") {
            const res = await app.fetch(new Request("http://localhost/prop", { headers }));
            const body: unknown = await res.json();
            return { id, status: res.status, cut: body };
          }
          headers.set("content-type", "application/json");
          const body = JSON.stringify({ id, reads: r.reads, writes: r.writes });
          const res = await app.fetch(new Request("http://localhost/prop", { method: "POST", headers, body }));
          return { id, status: res.status, cut: undefined };
        };
        let settled = false;
        const running = Promise.all(reqs.map((r, i) => send(r, `r${i}`))).finally(() => {
          settled = true;
        });
        // Hono's body streams also advance on macrotasks: release one scheduled step at a time, else yield a turn.
        while (!settled)
          if (sch.count() > 0) await sch.waitOne();
          else await new Promise<void>((resolve) => setImmediate(resolve));
        const outcomes = await running;

        // Build the graph: INIT and committed writers per key in version order (ww), reads (wr, rw).
        const edges = new Map<string, Set<string>>();
        const edge = (from: string, to: string) => {
          if (from === to) return;
          const out = edges.get(from) ?? new Set<string>();
          out.add(to);
          edges.set(from, out);
        };
        const read = (t: string, k: Key, v: string) => {
          const order = versions.get(k) ?? [];
          const at = order.indexOf(v);
          expect(at, `${t} read ${k}=${v}, never a committed version`).toBeGreaterThanOrEqual(0);
          edge(v, t);
          const next = order[at + 1];
          if (next !== undefined) edge(t, next);
        };
        for (const k of KEYS) {
          const order = versions.get(k) ?? [];
          for (let i = 1; i < order.length; i += 1) edge(order[i - 1] ?? INIT, order[i] ?? INIT);
        }
        reqs.forEach((r, i) => {
          const out = outcomes[i];
          if (out === undefined) return;
          if (r.kind === "get") {
            expect(out.status).toBe(200);
            const cut = s.object({ results: s.object({ "app.prop": s.object({ value: Cut }) }) }).parse(out.cut);
            expect(cut.ok).toBe(true);
            if (cut.ok) for (const k of KEYS) read(out.id, k, cut.value.results["app.prop"].value[k]);
            return;
          }
          expect([200, 409]).toContain(out.status);
          const committed = out.status === 200;
          if (committed) tally.committed += 1;
          else tally.conflicted += 1;
          for (const k of r.writes)
            expect(versions.get(k)?.includes(out.id), `${out.id} ${k} landed iff 200`).toBe(committed);
          if (!committed) return;
          const saw = seen.get(out.id) ?? {};
          for (const k of r.reads) {
            const v = saw[k];
            if (v !== undefined) read(out.id, k, v);
          }
        });
        expect(
          cycleIn(edges),
          `serialization graph has a cycle: ${sch
            .report()
            .map((t) => t.label)
            .join(", ")}`,
        ).toBe(false);
      }),
      { seed: 1337, numRuns: 150 },
    );
    expect(tally.committed).toBeGreaterThan(0);
    expect(tally.conflicted).toBeGreaterThan(0);
  }, 120_000);
});
