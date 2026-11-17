// Fixtures for the save-order tests: a fake `ctx.storage` whose `commit` succeeds, rejects, or holds per call, and a
// one-route counter app over it.
import { type Ctx, createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { createApp, topology } from "../src/index.ts";

export const KEY = "keel.store.test.count";
const Count = s.object({ n: s.number() });

export type Plan = "ok" | "reject" | "hold";

/**
 * A `ctx.storage` whose `commit` follows `plans` (then `ok`): `reject` rejects, `hold` waits for its `held` release.
 * A commit is compare-and-set when it lands, and each value it stores is pushed to `landed`.
 */
export function fakeStorage() {
  const data = new Map<string, string>();
  const plans: Plan[] = [];
  const landed: string[] = [];
  const held: (() => void)[] = [];
  let calls = 0;
  const now = (key: string): string | null => data.get(key) ?? null;
  const storage: Ctx["storage"] = {
    get: (key) => Promise.resolve(now(key)),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    read: (keys) => Promise.resolve(keys.map(now)),
    commit: (writes) => {
      calls += 1;
      const plan = plans.shift() ?? "ok";
      if (plan === "reject") return Promise.reject(new Error("storage unavailable"));
      const land = (): boolean => {
        if (writes.some((w) => now(w.key) !== w.expect)) return false;
        for (const w of writes)
          if (w.value !== undefined) {
            data.set(w.key, w.value);
            landed.push(w.value);
          }
        return true;
      };
      if (plan === "ok") return Promise.resolve(land());
      return new Promise<boolean>((resolve) => {
        held.push(() => resolve(land()));
      });
    },
  };
  return { storage, data, plans, landed, held, calls: () => calls };
}

/** An app whose `POST /count` increments `test.count` by one, over `storage`. */
export function counterApp(storage: Ctx["storage"]) {
  const base = createCtx({ mode: "sim", seed: 1337 });
  const ctx: Ctx = { clock: base.clock, random: base.random, net: base.net, storage, dispose: base.dispose };
  const counter = () => {
    const count = store(Count, { n: 0 }, { id: "test.count" });
    const inc = transaction(count, "test.inc", s.object({}), (st) => ({ n: st.n + 1 }));
    return { count, inc };
  };
  const routes = manifest({
    "app.count": {
      path: "/count",
      loader: loader({ output: Count, stores: counter }, async ({ stores }) => ok({ n: stores.count.get("n") })),
      component: () => document.createElement("p"),
    },
  });
  routes.actions({
    "app.count": {
      POST: action({ input: s.object({}), stores: counter }, (input, { stores }) => {
        const r = tx(stores.inc, input);
        return r.ok ? ok(null) : err(r.error);
      }),
    },
  });
  const app = createApp({ topology: topology({ web: { modules: ["app"], adapter: "node" } }), routes, ctx });
  const send = async (method: "GET" | "POST") => {
    const headers = new Headers({ accept: "application/json" });
    if (method === "POST") headers.set("content-type", "application/json");
    const init = method === "POST" ? { method, headers, body: "{}" } : { method, headers };
    return (await app).fetch(new Request("http://localhost/count", init));
  };
  return {
    inc: () => send("POST"),
    /** The count a fresh request reads (the in-process copy). */
    view: async (): Promise<unknown> => (await send("GET")).json(),
  };
}

/** The `n` stored under KEY, or null when nothing landed. */
export const storedN = (data: ReadonlyMap<string, string>): number | null => {
  const raw = data.get(KEY);
  if (raw === undefined) return null;
  const parsed = s.object({ state: Count }).parse(JSON.parse(raw));
  return parsed.ok ? parsed.value.state.n : null;
};
export const viewOf = (n: number) => ({ results: { "app.count": { ok: true, value: { n } } } });
