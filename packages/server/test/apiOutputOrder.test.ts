// Examples and a property (k.api Output): an API action's `ok` value is parsed by `output` before any store is saved,
// so a refused value commits nothing and answers 500 with one E1554 diag naming the path, never the value; a value
// `output` passes commits once and answers its encoding. Seed 1337.
import { createCtx } from "@keel/ctx";
import type { KeyValueStorage } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { mapStorage } from "./mapStorage.ts";

const SEED = 1337;
const Items = s.object({ items: s.array(s.int()) });
const Out = s.object({ n: s.int({ max: 100 }), at: s.string() });

async function setup() {
  const map = new Map<string, string>();
  const commits: string[][] = [];
  const inner = mapStorage(map);
  const storage: KeyValueStorage = {
    ...inner,
    commit: async (writes) => {
      commits.push(writes.map((w) => w.key));
      return inner.commit(writes);
    },
  };
  const ctx = { ...createCtx({ mode: "sim", seed: SEED }), storage };
  const factory = () => {
    const box = store(Items, { items: [] }, { id: "order.items" });
    const addTx = transaction(box, "order.add", s.object({ n: s.int() }), (st, { n }) => ({ items: [...st.items, n] }));
    return { box, add: addTx };
  };
  const c = contract("api", {
    "api.add": { method: "POST", path: "/api/add", body: s.object({ n: s.int() }), output: Out },
  });
  const add = action(c, "api.add", { stores: factory }, async ({ n }, { stores }) => {
    tx(stores.add, { n });
    return ok({ n, at: "here" });
  });
  const routes = manifest(c, { "api.add": { action: add } });
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  const post = (n: number) =>
    app.fetch(
      new Request("http://localhost/api/add", {
        method: "POST",
        body: JSON.stringify({ n }),
        headers: { "content-type": "application/json", "x-keel": "1" },
      }),
    );
  return { map, commits, lines, post };
}

describe("API action output order", () => {
  it("a value output refuses commits nothing; one it passes commits once, then answers", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), async (n) => {
        const t = await setup();
        const res = await t.post(n);
        if (n > 100) {
          expect(res.status).toBe(500);
          expect(t.commits).toEqual([]);
          expect(t.map.size).toBe(0);
          const diags = t.lines.filter((l) => l.includes('"E1554"'));
          expect(diags).toHaveLength(1);
          expect(diags[0]).toContain("action api.add data fails its output schema at n");
          expect(diags[0]).not.toContain(String(n));
        } else {
          expect(res.status).toBe(200);
          expect(res.headers.get("cache-control")).toBe("no-store");
          expect(await res.json()).toEqual({ ok: true, value: { n, at: "here" } });
          expect(t.commits).toHaveLength(1);
          expect(t.lines.some((l) => l.includes("E1554"))).toBe(false);
        }
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});
