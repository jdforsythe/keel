// Spec: k.persist, Conformance "An action saving two stores whose `commit` resolves `false` stores neither."
// Seed: 1337. Runs under plain Node; only runtime (JSON) requests are used.
// The ctx is a real ctx over a storage driver whose `commit` is refused (resolves `false`) without storing.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, it } from "vitest";

const Items = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });
const LISTS = "keel.store.app.lists";
const TODOS = "keel.store.app.todos";

type Write = { key: string; expect: string | null; value?: string };

function field(v: unknown, k: string): unknown {
  return typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;
}

const factory = () => {
  const lists = store(Items, { items: [] }, { id: "app.lists" });
  const todos = store(Items, { items: [] }, { id: "app.todos" });
  const addList = transaction(lists, "app.addList", Add, (state, { n }) => ({ items: [...state.items, n] }));
  const addTodo = transaction(todos, "app.addTodo", Add, (state, { n }) => ({ items: [...state.items, n] }));
  return { lists, todos, addList, addTodo };
};

function postJson(app: { fetch(r: Request): Promise<Response> }, path: string, body: unknown): Promise<Response> {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
    }),
  );
}

// A driver over a Map; `refuse` makes every `commit` resolve false and store nothing.
function driver(refuse: boolean) {
  const data = new Map<string, string>();
  const commits: Write[][] = [];
  const storage = {
    get: (key: string) => Promise.resolve(data.get(key) ?? null),
    set: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
    read: (keys: readonly string[]) => Promise.resolve(keys.map((k) => data.get(k) ?? null)),
    commit: (writes: readonly Write[]) => {
      commits.push([...writes]);
      if (refuse || writes.some((w) => (data.get(w.key) ?? null) !== w.expect)) return Promise.resolve(false);
      for (const w of writes) if (w.value !== undefined) data.set(w.key, w.value);
      return Promise.resolve(true);
    },
  };
  return { data, commits, storage };
}

async function setup(refuse: boolean) {
  const d = driver(refuse);
  const ctx = createCtx({ mode: "real", drivers: { storage: d.storage } });
  const appContract = contract("app", {
    "app.both": { path: "/both" },
  });

  const both = action(appContract, "app.both", { input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.addList, { n });
    tx(stores.addTodo, { n });
    return ok(null);
  });
  const routes = manifest(appContract, {
    "app.both": { component: (): Node => document.createElement("p"), POST: both },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { app, ...d };
}

it("an action saving two stores whose `commit` resolves `false` stores neither", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (n) => {
      const refused = await setup(true);
      const res = await postJson(refused.app, "/both", { n });
      expect(res.status).toBe(409);
      expect(field(field(await res.json(), "error"), "code")).toBe("keel.conflict");
      expect(refused.data.size).toBe(0);
      // The save was one `commit` naming both stores' keys, not one `commit` per store.
      expect(refused.commits.length).toBe(1);
      expect(refused.commits[0]?.map((w) => w.key).sort()).toEqual([LISTS, TODOS]);

      // The same action over an accepting driver stores both.
      const accepted = await setup(false);
      expect((await postJson(accepted.app, "/both", { n })).status).toBe(200);
      expect([...accepted.data.keys()].sort()).toEqual([LISTS, TODOS]);
    }),
    { seed: 1337, numRuns: 8 },
  );
});
