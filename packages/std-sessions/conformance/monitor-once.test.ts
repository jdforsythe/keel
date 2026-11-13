// Spec: std.monitor, Conformance "Entries committed before `run` started are not counted, and each entry is counted once across saves and merges."
// Seed: 1337.
// @vitest-environment node
// Skipped until `monitor` exists. A store holding entries when `run` starts is read from `ctx.storage`.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { monitor, monitorRoutes } from "@keel/std-sessions/monitor";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

// ---- fixture (shared text of the monitor-* files): a server store with two transactions, an API route table ----------
// Assumptions (the spec is silent, each is an ordinary reading of k.server / k.router / k.api, as sync-save-observe does):
// - `monitor` and `monitorRoutes` are both exported by `@keel/std-sessions/monitor`;
// - `ctx.storage` holds a server store as the JSON text of its `snapshot()` under `keel.store.<id>`, and `sessions.tally`
//   as the JSON text of the `Tally`;
// - an API route answers `{ results: { <route id>: Result } }` as `sessions.list` does in the ingest tests;
// - the server mints the caller cookie `keel-caller` on a POST, whose value is hashed by `readers` as in the ingest tests.
const SEED = 1337;
const TALLY_KEY = "sessions.tally";
const SECRET = "k".repeat(32);

const Todos = s.object({ items: s.array(s.string()), flips: s.int() });
const Text1 = s.object({ text: s.string() });

const factory = () => {
  const todos = store(Todos, { items: [], flips: 0 }, { id: "api.todos" });
  const addTodo = transaction(todos, "api.addTodo", Text1, (st, p) => ({ ...st, items: [...st.items, p.text] }));
  const toggleTodo = transaction(todos, "api.toggleTodo", Text1, (st) => ({ ...st, flips: st.flips + 1 }));
  return { todos, addTodo, toggleTodo };
};

type Op = "add" | "toggle";
const NAME: Record<Op, string> = { add: "api.addTodo", toggle: "api.toggleTodo" };
const opArb: fc.Arbitrary<Op> = fc.constantFrom<Op>("add", "toggle");

/** The `tx` map a run of `ops` should leave: one run per commit, keyed by transaction name. */
const expectedTx = (ops: readonly Op[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const op of ops) out[NAME[op]] = (out[NAME[op]] ?? 0) + 1;
  return out;
};

type Fetcher = { fetch(r: Request): Promise<Response> };

async function boot() {
  const map = new Map<string, string>();
  const base = createCtx({ mode: "sim", seed: SEED });
  const storage = {
    async get(key: string): Promise<string | null> {
      return map.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      map.set(key, value);
    },
  };
  const ctx = { ...base, storage };
  const add = action({ input: Text1, stores: factory }, async ({ text }, { stores }) => {
    tx(stores.addTodo, { text });
    return ok(null);
  });
  const toggle = action({ input: Text1, stores: factory }, async ({ text }, { stores }) => {
    tx(stores.toggleTodo, { text });
    return ok(null);
  });
  const component = (): Node => document.createElement("p");
  const routes = manifest({ "api.add": { path: "/add", component }, "api.toggle": { path: "/toggle", component } });
  routes.actions({ "api.add": { POST: add }, "api.toggle": { POST: toggle } });
  const actions = await createApp({
    topology: topology({ api: { modules: ["api"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
    secret: SECRET,
  });
  const tallyApp = await createApp({
    topology: topology({ sessions: { modules: ["sessions"], adapter: "node" } }),
    routes: monitorRoutes,
    ctx,
    mode: "production",
    secret: SECRET,
  });
  return { map, base, ctx, actions, tallyApp };
}

type Booted = Awaited<ReturnType<typeof boot>>;

/** Yields enough microtask turns for a runner's pending storage reads and writes to finish. */
async function flush(): Promise<void> {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}

/** One committed action (`add` or `toggle`) through the server; `text` is its payload. */
function commit(app: Fetcher, op: Op, text: string, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    origin: "http://localhost",
  };
  if (cookie !== undefined) headers.cookie = `keel-caller=${cookie}`;
  return app.fetch(new Request(`http://localhost/${op}`, { method: "POST", headers, body: JSON.stringify({ text }) }));
}

/** Commits `ops` in order, each its own request (one save each), and checks each was stored. */
async function commitAll(t: Booted, ops: readonly Op[], cookie?: string): Promise<void> {
  let n = 0;
  for (const op of ops) {
    const res = await commit(t.actions, op, `t${n++}`, cookie);
    expect(res.status).toBe(200);
    await flush();
  }
}

/** The caller token the server minted for a first POST. */
async function mint(t: Booted, text = "mint"): Promise<string> {
  const res = await commit(t.actions, "add", text);
  const m = /keel-caller=([^;]+)/.exec(res.headers.get("set-cookie") ?? "");
  if (m === null || m[1] === undefined) throw new Error("no caller cookie minted");
  return m[1];
}

const hashOf = (value: string): string => createHash("sha256").update(value).digest("base64url");

/** Puts `caller` (a cookie token) in `readers`. */
const allow = (ctx: Booted["ctx"], caller: string) =>
  bindStd(ctx, { "@keel/std-sessions": { sessions: { readers: [hashOf(caller)] } } });

type Tally = { v: number; from: number; to: number; tx: Record<string, number> };

/** The `Tally` stored under `sessions.tally`, `null` when nothing is stored. */
function tallyOf(map: Map<string, string>): Tally | null {
  const raw = map.get(TALLY_KEY);
  if (raw === undefined) return null;
  return tallyFrom(JSON.parse(raw));
}

function tallyFrom(value: unknown): Tally {
  const v = Reflect.get(Object(value), "v");
  const from = Reflect.get(Object(value), "from");
  const to = Reflect.get(Object(value), "to");
  const tx: Record<string, number> = {};
  for (const [k, n] of Object.entries(Object(Reflect.get(Object(value), "tx")))) {
    if (typeof n !== "number") throw new Error("tally: a count is not a number");
    tx[k] = n;
  }
  if (typeof v !== "number" || typeof from !== "number" || typeof to !== "number") {
    throw new Error("tally: v, from or to is not a number");
  }
  return { v, from, to, tx };
}

/** GET /sessions/tally. */
function getTally(app: Fetcher, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (cookie !== undefined) headers.cookie = `keel-caller=${cookie}`;
  return app.fetch(new Request("http://localhost/sessions/tally", { headers, redirect: "manual" }));
}

/** The `Result` the route `sessions.tally` answered in its body. */
async function resultOf(res: Response): Promise<{ ok: unknown; value: unknown }> {
  const body: unknown = await res.json();
  const result: unknown = Reflect.get(Object(Reflect.get(Object(body), "results")), "sessions.tally");
  return { ok: Reflect.get(Object(result), "ok"), value: Reflect.get(Object(result), "value") };
}

const nameArb = fc.stringMatching(/^[a-z]{2,6}\.[a-zA-Z]{2,8}$/);
const tallyArb: fc.Arbitrary<Tally> = fc
  .tuple(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: 1_000_000 }))
  .chain(([a, b]) =>
    fc
      .dictionary(nameArb, fc.integer({ min: 1, max: 500 }), { maxKeys: 5 })
      .map((tx): Tally => ({ v: 1, from: Math.min(a, b), to: Math.max(a, b), tx })),
  );

/** A fetch for `run`: forwards to `app` with the reader's cookie; `seen` collects the cookie header the command sent. */
const forwarding =
  (app: Fetcher, token: string, seen: string[] = []) =>
  (url: string, init?: RequestInit): Promise<Response> => {
    seen.push(new Headers(init?.headers).get("cookie") ?? "");
    return app.fetch(new Request(url, { headers: { accept: "application/json", cookie: `keel-caller=${token}` } }));
  };

const MONITORED = ".keel/monitored.json";
const dirs: string[] = [];
const mkDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-monitor-"));
  dirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

const CLAUSE =
  "Entries committed before `run` started are not counted, and each entry is counted once across saves and merges.";

describe("std.monitor: entries are counted once, from where `run` started", () => {
  test(`${CLAUSE} (entries committed before run started)`, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(opArb, { minLength: 1, maxLength: 4 }),
        fc.array(opArb, { minLength: 1, maxLength: 4 }),
        async (before, after) => {
          const t = await boot();
          await commitAll(t, before);
          const ac = new AbortController();
          const done = monitor.run(t.ctx, ac.signal);
          await flush();
          await commitAll(t, after);
          await t.base.clock.advance(60_000);
          await flush();
          expect(tallyOf(t.map)?.tx).toEqual(expectedTx(after));
          ac.abort();
          await done;
        },
      ),
      { seed: 1337, numRuns: 15 },
    );
  });

  test(`${CLAUSE} (each entry once across saves and merges)`, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(opArb, fc.boolean()), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 3 }),
        async (script, extraMerges) => {
          const t = await boot();
          const ac = new AbortController();
          const done = monitor.run(t.ctx, ac.signal);
          await flush();
          let n = 0;
          for (const [op, merge] of script) {
            expect((await commit(t.actions, op, `t${n++}`)).status).toBe(200);
            await flush();
            if (merge) {
              await t.base.clock.advance(60_000);
              await flush();
            }
          }
          // merges with nothing new to count change no count
          for (let i = 0; i <= extraMerges; i++) {
            await t.base.clock.advance(60_000);
            await flush();
          }
          expect(tallyOf(t.map)?.tx).toEqual(expectedTx(script.map(([op]) => op)));
          ac.abort();
          await done;
          expect(tallyOf(t.map)?.tx).toEqual(expectedTx(script.map(([op]) => op)));
        },
      ),
      { seed: 1337, numRuns: 15 },
    );
  });
});
