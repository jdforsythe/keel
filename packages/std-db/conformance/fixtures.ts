// Shared fixtures for the std.db conformance files (not a test file).
// Assumption: spec/std/std.db.md says how `postgres(url)` is given a URL only; it does not say how PGlite reaches it.
// With `KEEL_TEST_POSTGRES_URL` unset the helper calls `postgres(url, { clientFactory })`, `clientFactory` returning a
// `pg` Pool-shaped object (`query`, `connect`, `end`) over one in-process PGlite. That second argument is an assumption.
// With `KEEL_TEST_POSTGRES_URL` set, `postgres(new URL(that))` runs against the real server and the keel tables are dropped first.
// Assumption: a driver's `close()` (k.deploy: "awaits close()") is read without a cast; the spec names no closing method on the storage.
// Assumption: child processes run `node --experimental-strip-types` on workspace sources, found by relative path (`packages/<pkg>/src/index.ts`).
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { KeyValueStorage } from "@keel/ctx";
import { postgres } from "@keel/std-db/postgres";
import { sqlite } from "@keel/std-db/sqlite";
import pg from "pg";

export type Kind = "sqlite" | "postgres";
export const KINDS: readonly Kind[] = ["sqlite", "postgres"];
export const SEED = 1337;

export const tempDir = (): string => mkdtempSync(join(tmpdir(), "keel-db-"));
export const removeDir = (dir: string): void => rmSync(dir, { recursive: true, force: true });

export async function closeStorage(storage: unknown): Promise<void> {
  const f: unknown = Reflect.get(Object(storage), "close");
  if (typeof f !== "function") throw new Error("the storage driver has no close()");
  await Reflect.apply(f, storage, []);
}

interface PoolResult {
  readonly rows: readonly unknown[];
}
interface PoolClient {
  query(text: string, values?: readonly unknown[]): Promise<PoolResult>;
  release(): void;
}
interface Pool {
  query(text: string, values?: readonly unknown[]): Promise<PoolResult>;
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}

/** A pg Pool-shaped adapter over one PGlite: a checked-out client holds a mutex until released, so transactions never interleave. */
function pglitePool(db: PGlite): Pool {
  let tail: Promise<void> = Promise.resolve();
  const connect = async (): Promise<PoolClient> => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => {
      release = r;
    });
    const turn = tail;
    tail = turn.then(() => held);
    await turn;
    return {
      query: async (text, values) => {
        const r = await db.query(text, values === undefined ? undefined : [...values]);
        return { rows: r.rows };
      },
      release,
    };
  };
  return {
    connect,
    query: async (text, values) => {
      const c = await connect();
      try {
        return await c.query(text, values);
      } finally {
        c.release();
      }
    },
    end: async () => undefined,
  };
}

export interface Rig {
  readonly kind: Kind;
  readonly dir: string;
  readonly url: URL;
  /** A new driver on the shared database: a new connection. */
  open(): Promise<KeyValueStorage>;
  /** Creates the two keel tables and a `layout` row holding `n`, as a package of another version would. */
  seedLayout(n: number): Promise<void>;
  layout(): Promise<string | null>;
  /** Closes every driver `open` returned, then removes the temporary directory and the database. */
  stop(): Promise<void>;
}

const CREATE = [
  "create table keel_kv (key text primary key, value text not null)",
  "create table keel_meta (name text primary key, value text not null)",
];

export async function makeRig(kind: Kind): Promise<Rig> {
  const dir = tempDir();
  const opened: KeyValueStorage[] = [];
  const track = (s: KeyValueStorage): KeyValueStorage => {
    opened.push(s);
    return s;
  };
  if (kind === "sqlite") {
    const file = join(dir, "keel.sqlite");
    const url = pathToFileURL(file);
    return {
      kind,
      dir,
      url,
      open: async () => track(await sqlite(url)),
      seedLayout: async (n) => {
        const db = new DatabaseSync(file);
        try {
          for (const sql of CREATE) db.exec(sql);
          db.prepare("insert into keel_meta (name, value) values ('layout', ?)").run(String(n));
        } finally {
          db.close();
        }
      },
      layout: async () => {
        const db = new DatabaseSync(file);
        try {
          const row = db.prepare("select value from keel_meta where name = 'layout'").get();
          const v: unknown = row === undefined ? undefined : Reflect.get(row, "value");
          return typeof v === "string" ? v : null;
        } finally {
          db.close();
        }
      },
      stop: async () => {
        for (const s of opened) await closeStorage(s);
        removeDir(dir);
      },
    };
  }
  const real = process.env.KEEL_TEST_POSTGRES_URL;
  if (real !== undefined && real !== "") {
    const url = new URL(real);
    const admin = new pg.Client({ connectionString: real });
    await admin.connect();
    await admin.query("drop table if exists keel_kv");
    await admin.query("drop table if exists keel_meta");
    return {
      kind,
      dir,
      url,
      open: async () => track(await postgres(url)),
      seedLayout: async (n) => {
        for (const sql of CREATE) await admin.query(sql);
        await admin.query("insert into keel_meta (name, value) values ('layout', $1)", [String(n)]);
      },
      layout: async () => {
        const r = await admin.query("select value from keel_meta where name = 'layout'");
        const v: unknown = r.rows[0]?.value;
        return typeof v === "string" ? v : null;
      },
      stop: async () => {
        for (const s of opened) await closeStorage(s);
        await admin.end();
        removeDir(dir);
      },
    };
  }
  const db = new PGlite();
  await db.waitReady;
  const pool = pglitePool(db);
  const url = new URL("postgres://keel:keel@localhost:5432/keel");
  return {
    kind,
    dir,
    url,
    open: async () => track(await postgres(url, { clientFactory: () => pool })),
    seedLayout: async (n) => {
      for (const sql of CREATE) await db.exec(sql);
      await db.query("insert into keel_meta (name, value) values ('layout', $1)", [String(n)]);
    },
    layout: async () => {
      const r = await db.query("select value from keel_meta where name = 'layout'");
      const v: unknown = field(r.rows[0], "value");
      return typeof v === "string" ? v : null;
    },
    stop: async () => {
      for (const s of opened) await closeStorage(s);
      await db.close();
      removeDir(dir);
    },
  };
}

// ---- child processes ----

export interface Exit {
  readonly code: number | null;
  readonly signal: string | null;
}
export interface Proc {
  send(line: string): void;
  /** Resolves with the rest of the first unread stdout line that starts with `prefix`; rejects if the child exits first. */
  waitLine(prefix: string): Promise<string>;
  readonly exited: Promise<Exit>;
  /** Everything the child wrote to stdout and stderr. */
  output(): string;
  /** SIGKILL if still running, then waits for exit. */
  stop(): Promise<Exit>;
}

export function spawnNode(script: string, env: Readonly<Record<string, string>>): Proc {
  const child = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", script], {
    cwd: dirname(script),
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines: string[] = [];
  const waiters: { prefix: string; resolve: (rest: string) => void; reject: (e: Error) => void }[] = [];
  let all = "";
  let partial = "";
  let done = false;
  const offer = (): void => {
    for (let w = 0; w < waiters.length; w++) {
      const waiter = waiters[w];
      if (waiter === undefined) continue;
      const i = lines.findIndex((l) => l.startsWith(waiter.prefix));
      if (i < 0) continue;
      const line = lines.splice(i, 1)[0] ?? "";
      waiters.splice(w, 1);
      w--;
      waiter.resolve(line.slice(waiter.prefix.length).trim());
    }
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    all += chunk;
    partial += chunk;
    const parts = partial.split("\n");
    partial = parts.pop() ?? "";
    lines.push(...parts);
    offer();
  });
  child.stderr.on("data", (chunk: string) => {
    all += chunk;
  });
  const exited = new Promise<Exit>((resolve) => {
    child.on("close", (code, signal) => {
      done = true;
      for (const w of waiters.splice(0)) w.reject(new Error(`child exited before "${w.prefix}"\n${all}`));
      resolve({ code, signal });
    });
  });
  return {
    send: (line) => {
      child.stdin.write(`${line}\n`);
    },
    waitLine: (prefix) =>
      new Promise<string>((resolve, reject) => {
        waiters.push({ prefix, resolve, reject });
        if (done) reject(new Error(`child exited before "${prefix}"\n${all}`));
        else offer();
      }),
    exited,
    output: () => all,
    stop: async () => {
      if (!done) child.kill("SIGKILL");
      return exited;
    },
  };
}

const pkgUrl = (pkg: string): string => new URL(`../../${pkg}/src/index.ts`, import.meta.url).href;
// ASSUMPTION: the `@keel/router/contract` entry resolves from the package folder at `src/contract/index.ts`.
const contractUrl = (): string => new URL("../../router/src/contract/index.ts", import.meta.url).href;
const sqliteUrl = (): string => new URL("../src/sqlite/index.ts", import.meta.url).href;
const postgresUrl = (): string => new URL("../src/postgres/index.ts", import.meta.url).href;

export function writeScript(dir: string, name: string, source: string): string {
  const file = join(dir, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
  return file;
}

/** The store key of the notes store the app script serves (k.persist: `keel.store.<id>`). */
export const NOTES_KEY = "keel.store.t.notes";

/**
 * A child that serves `createApp` over `sqlite(KEEL_DATABASE_URL)` with one store `t.notes` and one POST action
 * that adds a note. Stdin commands: `post <text>` (prints `done <status>`), `get` (prints `items <json>`),
 * `raw` (prints `raw <json string of the stored snapshot>`), `release` (lets a held action save), `quit`.
 * With `KEEL_HOLD=1` the action prints `arrived` after its transaction and waits for `release` before it returns.
 * Prints `ready` once serving.
 */
export function appScript(): string {
  return `import { createInterface } from "node:readline";
import { createCtx } from "${pkgUrl("ctx")}";
import { action, loader, manifest } from "${pkgUrl("router")}";
import { contract } from "${contractUrl()}";
import { ok, s } from "${pkgUrl("schema")}";
import { createApp, topology } from "${pkgUrl("server")}";
import { store, transaction, tx } from "${pkgUrl("store")}";
import { sqlite } from "${sqliteUrl()}";
const Notes = s.object({ items: s.array(s.string()) });
const Add = s.object({ text: s.string() });
const factory = () => {
  const notes = store(Notes, { items: [] }, { id: "t.notes" });
  const add = transaction(notes, "t.add", Add, (state, { text }) => ({ items: [...state.items, text] }));
  return { notes, add };
};
const t = contract("t", { "t.page": { path: "/notes" } });
let gate = null;
const write = action(t, "t.page", { input: Add, stores: factory }, async ({ text }, { stores }) => {
  tx(stores.add, { text });
  if (process.env.KEEL_HOLD === "1") {
    console.log("arrived");
    await new Promise((resolve) => { gate = resolve; });
  }
  return ok(null);
});
const read = loader(t, "t.page", { output: Notes, stores: factory }, async ({ stores }) => ok({ items: [...stores.notes.get("items")] }));
const routes = manifest(t, { "t.page": { loader: read, component: () => ({}), POST: write } });
const storage = await sqlite(new URL(process.env.KEEL_DATABASE_URL));
const ctx = createCtx({ mode: "real", drivers: { storage } });
const app = await createApp({ topology: topology({ web: { modules: ["t"], adapter: "node" } }), routes, ctx, mode: "production" });
const headers = { accept: "application/json", "content-type": "application/json", origin: "http://localhost" };
console.log("ready");
for await (const line of createInterface({ input: process.stdin })) {
  const [cmd, ...rest] = line.split(" ");
  if (cmd === "post") {
    app.fetch(new Request("http://localhost/notes", { method: "POST", body: JSON.stringify({ text: rest.join(" ") }), headers }))
      .then((res) => console.log("done " + res.status));
  } else if (cmd === "get") {
    app.fetch(new Request("http://localhost/notes", { headers: { accept: "application/json" } }))
      .then((res) => res.json())
      .then((body) => console.log("items " + JSON.stringify(body.results["t.page"].value.items)));
  } else if (cmd === "raw") {
    storage.get("${NOTES_KEY}").then((v) => console.log("raw " + JSON.stringify(v)));
  } else if (cmd === "release") {
    if (gate !== null) gate();
  } else if (cmd === "quit") {
    await app.close();
    process.exit(0);
  }
}
`;
}

/** A child that only opens the driver named by kind on KEEL_DATABASE_URL and prints opened; failures are left to the driver. */
export function openScript(kind: Kind): string {
  const [name, url] = kind === "sqlite" ? ["sqlite", sqliteUrl()] : ["postgres", postgresUrl()];
  return `import { ${name} } from "${url}";
await ${name}(new URL(process.env.KEEL_DATABASE_URL));
console.log("opened");
process.exit(0);
`;
}

export const field = (v: unknown, k: string): unknown =>
  typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;
