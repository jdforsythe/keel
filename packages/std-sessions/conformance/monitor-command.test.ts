// Spec: std.monitor, Conformance "`keel session monitor` against a served tally writes `.keel/monitored.json` that k.ledger reads; against an unreachable URL it reports E2010 and writes nothing."
// Seed: 1337.
// @vitest-environment node
// Skipped until the `monitor` command exists. Driven through `run(['session', 'monitor', url], { cwd, env, fetch })` over a
// temp directory; the tally is served by `monitorRoutes` through an injected fetch that sends the reader's own cookie.
// Assumptions (the spec is silent): the token is read from the environment variable `KEEL_SESSIONS_TOKEN` and sent in the
// request's cookie header; `keys sorted` means the keys of `tx`; "that k.ledger reads" is checked as k.ledger's shape for
// `.keel/monitored.json` (`{ v: 1, origin, from, to, tx: { [name]: runs } }`, else E1711), not by running `keel ledger`.
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
import { monitorRoutes } from "@keel/std-sessions/monitor";
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
  "`keel session monitor` against a served tally writes `.keel/monitored.json` that k.ledger reads; against an unreachable URL it reports E2010 and writes nothing.";

const URL_ = "http://127.0.0.1:4100";

/** A booted server holding `tally`, a reader token, and a cwd to run in. */
async function served(tally: Tally) {
  const t = await boot();
  t.map.set(TALLY_KEY, JSON.stringify(tally));
  const token = await mint(t);
  allow(t.ctx, token);
  return { t, token, dir: mkDir() };
}

const records = (stdout: string): Record<string, unknown>[] =>
  stdout
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => {
      const v: unknown = JSON.parse(l);
      if (typeof v !== "object" || v === null) throw new Error("not a record");
      return { ...v };
    });

describe("std.monitor: keel session monitor", () => {
  test(`${CLAUSE} (a served tally is written as .keel/monitored.json)`, async () => {
    await fc.assert(
      fc.asyncProperty(tallyArb, async (tally) => {
        const { t, token, dir } = await served(tally);
        const seen: string[] = [];
        const r = await run(["session", "monitor", URL_, "--format=json"], {
          cwd: dir,
          apply: applyTo(dir),
          env: { KEEL_SESSIONS_TOKEN: token },
          fetch: forwarding(t.tallyApp, token, seen),
        });
        expect(r.code).toBe(0);
        expect(seen).toHaveLength(1);
        expect(seen[0]).toContain(token);
        const written: unknown = JSON.parse(fs.readFileSync(path.join(dir, MONITORED), "utf8"));
        // k.ledger's shape for the file
        expect(Object.keys(Object(written)).sort()).toEqual(["from", "origin", "to", "tx", "v"]);
        expect(Reflect.get(Object(written), "v")).toBe(1);
        expect(Reflect.get(Object(written), "origin")).toBe(URL_);
        expect(tallyFrom(written)).toEqual(tally);
        const names = Object.keys(Object(Reflect.get(Object(written), "tx")));
        expect(names).toEqual([...names].sort());
        for (const n of Object.values(tally.tx)) expect(Number.isInteger(n) && n >= 1).toBe(true);
      }),
      { seed: 1337, numRuns: 6 },
    );
  });

  test(`${CLAUSE} (an unreachable URL reports E2010 and writes nothing)`, async () => {
    const dir = mkDir();
    const down = (): Promise<Response> => Promise.reject(new TypeError("fetch failed"));
    const r = await run(["session", "monitor", URL_, "--format=compact"], {
      cwd: dir,
      apply: applyTo(dir),
      env: { KEEL_SESSIONS_TOKEN: "x" },
      fetch: down,
    });
    expect(r.stdout).toMatch(/E2010/);
    expect(r.code).toBe(1);
    expect(fs.existsSync(path.join(dir, MONITORED))).toBe(false);
    expect(fs.existsSync(path.join(dir, ".keel"))).toBe(false);
  });

  test(`${CLAUSE} (it prints one session.monitor record, and the default file is .keel/monitored.json)`, async () => {
    await fc.assert(
      fc.asyncProperty(tallyArb, async (tally) => {
        const { t, token, dir } = await served(tally);
        const r = await run(["session", "monitor", URL_, "--format=json"], {
          cwd: dir,
          apply: applyTo(dir),
          env: { KEEL_SESSIONS_TOKEN: token },
          fetch: forwarding(t.tallyApp, token),
        });
        const found = records(r.stdout).filter((x) => x.kind === "session.monitor");
        expect(found).toHaveLength(1);
        expect(found[0]).toEqual({
          kind: "session.monitor",
          origin: URL_,
          transactions: Object.keys(tally.tx).length,
          runs: Object.values(tally.tx).reduce((a, b) => a + b, 0),
          file: MONITORED,
        });
      }),
      { seed: 1337, numRuns: 6 },
    );
  });

  test(`${CLAUSE} (compact line: ok session monitor <n> transactions, <m> runs -> <file>)`, async () => {
    const { t, token, dir } = await served({ v: 1, from: 10, to: 70, tx: { "a.one": 4, "a.two": 3 } });
    const r = await run(["session", "monitor", URL_, "--format=compact"], {
      cwd: dir,
      apply: applyTo(dir),
      env: { KEEL_SESSIONS_TOKEN: token },
      fetch: forwarding(t.tallyApp, token),
    });
    expect(r.stdout).toContain(`ok session monitor 2 transactions, 7 runs -> ${MONITORED}`);
  });

  test(`${CLAUSE} (--out names the file)`, async () => {
    const { t, token, dir } = await served({ v: 1, from: 1, to: 2, tx: { "a.one": 1 } });
    const r = await run(["session", "monitor", URL_, "--out", "out/tally.json", "--format=json"], {
      cwd: dir,
      apply: applyTo(dir),
      env: { KEEL_SESSIONS_TOKEN: token },
      fetch: forwarding(t.tallyApp, token),
    });
    expect(records(r.stdout).find((x) => x.kind === "session.monitor")?.file).toBe("out/tally.json");
    expect(fs.existsSync(path.join(dir, "out/tally.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, MONITORED))).toBe(false);
  });
});
