// Spec: std.monitor, Conformance "No value of a payload, a caller hash or a store state appears in `sessions.tally` or in the written file."
// Seed: 1337.
// @vitest-environment node
// Skipped until `monitor` exists. Payloads (which also enter the store's state) hold a marker; the caller token and its hash are
// the other values that must not leave. Untestable in general: "entry time" and "request detail" have no named value to look for,
// so the tally is checked to hold exactly the keys `v`, `from`, `to` and `tx`.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import "@keel/std-sessions/tools";
import { monitor, monitorRoutes } from "@keel/std-sessions/monitor";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { applyTo } from "./fixtures.ts";

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
    async read(keys: readonly string[]): Promise<(string | null)[]> {
      return keys.map((k) => map.get(k) ?? null);
    },
    async commit(
      writes: ReadonlyArray<{ key: string; expect: string | null; value?: string | undefined }>,
    ): Promise<boolean> {
      if (new Set(writes.map((w) => w.key)).size !== writes.length)
        throw Object.assign(new Error("commit names one key twice"), { code: "E1606" });
      if (writes.some((w) => (map.get(w.key) ?? null) !== w.expect)) return false;
      for (const w of writes) {
        if (w.value === undefined) map.delete(w.key);
        else map.set(w.key, w.value);
      }
      return true;
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
  "No value of a payload, a caller hash or a store state appears in `sessions.tally` or in the written file.";

const markerArb = fc.stringMatching(/^[a-z0-9]{8,12}$/).map((m) => `zq9${m}`);

describe("std.monitor: privacy", () => {
  test(CLAUSE, async () => {
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(markerArb, { minLength: 2, maxLength: 5 }), async (markers) => {
        const t = await boot();
        const token = await mint(t, "zq9mint");
        allow(t.ctx, token);
        const ac = new AbortController();
        const done = monitor.run(t.ctx, ac.signal);
        await flush();
        for (const [i, m] of markers.entries()) {
          expect((await commit(t.actions, i % 2 === 0 ? "add" : "toggle", m, token)).status).toBe(200);
          await flush();
        }
        await t.base.clock.advance(60_000);
        await flush();
        ac.abort();
        await done;

        const stored = t.map.get(TALLY_KEY);
        expect(stored).toBeDefined();
        const raw: unknown = JSON.parse(stored ?? "null");
        expect(Object.keys(Object(raw)).sort()).toEqual(["from", "to", "tx", "v"]);

        // what the route returns, and the file the command writes from it
        const served = await getTally(t.tallyApp, token);
        expect(served.status).toBe(200);
        const body = await served.clone().text();
        const dir = mkDir();
        const r = await run(["session", "monitor", "http://localhost", "--format=json"], {
          cwd: dir,
          apply: applyTo(dir),
          env: { KEEL_SESSIONS_TOKEN: token },
          fetch: forwarding(t.tallyApp, token),
        });
        expect(r.code).toBe(0);
        const file = fs.readFileSync(path.join(dir, MONITORED), "utf8");

        const secrets = [...markers, "zq9mint", token, hashOf(token)];
        for (const text of [stored ?? "", body, file]) {
          for (const secret of secrets) expect(text).not.toContain(secret);
        }
      }),
      { seed: 1337, numRuns: 6 },
    );
  });
});
