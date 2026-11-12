// An action whose `tx` is refused as concurrent (`keel.conflict`) answers 409 with the refusal, saves nothing and
// reports no `save`; a write at the current head saves and reports its new head. Seed 1337.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Count = s.object({ n: s.int() });

async function setup() {
  const map = new Map<string, string>();
  const base = createCtx({ mode: "sim", seed: 1337 });
  const storage = {
    get: (key: string) => Promise.resolve(map.get(key) ?? null),
    set: (key: string, value: string) => {
      map.set(key, value);
      return Promise.resolve();
    },
  };
  const ctx = { ...base, storage };
  const saves: CtxEvent[] = [];
  observe(ctx, (e) => {
    if (e.kind === "save") saves.push(e);
  });
  const counter = () => {
    const count = store(Count, { n: 0 }, { id: "test.count" });
    const inc = transaction(count, "test.inc", s.object({ base: s.int() }), (st) => ({ n: st.n + 1 }));
    return { count, inc };
  };
  const routes = manifest({ "app.inc": { path: "/inc", component: () => document.createElement("p") } });
  routes.actions({
    "app.inc": {
      POST: action({ input: s.object({ base: s.int() }), stores: counter }, (input, { stores }) => {
        const r = tx(stores.inc, input, { base: input.base });
        return r.ok ? ok(null) : err(r.error);
      }),
    },
  });
  const app = await createApp({ topology: topology({ web: { modules: ["app"], adapter: "node" } }), routes, ctx });
  const inc = (base: number) =>
    app.fetch(
      new Request("http://localhost/inc", {
        method: "POST",
        body: JSON.stringify({ base }),
        headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
      }),
    );
  return { inc, saves, map };
}

describe("server: concurrent writes", () => {
  it("a write at the current head saves and reports the new head", async () => {
    const { inc, saves } = await setup();
    expect((await inc(0)).status).toBe(200);
    expect((await inc(1)).status).toBe(200);
    expect(saves).toEqual([
      { kind: "save", store: "test.count", head: 1 },
      { kind: "save", store: "test.count", head: 2 },
    ]);
  });

  it("a stale base under 'reject' is 409 keel.conflict carrying the head, saves nothing and reports nothing", async () => {
    const { inc, saves, map } = await setup();
    await inc(0);
    const stored = map.get("keel.store.test.count");
    const res = await inc(0);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: { code: "keel.conflict", data: { store: "test.count", transaction: "test.inc", base: 0, head: 1 } },
    });
    expect(map.get("keel.store.test.count")).toBe(stored);
    expect(saves).toHaveLength(1);
  });
});
