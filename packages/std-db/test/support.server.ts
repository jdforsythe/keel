// The helpers the package's own tests share: a rig per driver (SQLite on a temporary file, Postgres on PGlite or on the
// server `KEEL_TEST_POSTGRES_URL` names, its keel tables dropped first) and child `node` processes.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { KeyValueStorage } from "@keel/ctx";
import pg from "pg";
import { postgres } from "../src/postgres/index.server.ts";
import { sqlite } from "../src/sqlite/index.server.ts";

/** The engine's two WebAssembly modules, compiled once for the file's every PGlite instead of for each one. */
let modules: { pgliteWasmModule: WebAssembly.Module; initdbWasmModule: WebAssembly.Module } | undefined;
function pgliteModules(): { pgliteWasmModule: WebAssembly.Module; initdbWasmModule: WebAssembly.Module } {
  if (modules === undefined) {
    const dist = dirname(createRequire(import.meta.url).resolve("@electric-sql/pglite"));
    const load = (name: string): WebAssembly.Module => new WebAssembly.Module(readFileSync(join(dist, name)));
    modules = { pgliteWasmModule: load("pglite.wasm"), initdbWasmModule: load("initdb.wasm") };
  }
  return modules;
}

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
  const db = new PGlite(pgliteModules());
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

export function writeScript(dir: string, name: string, source: string): string {
  const file = join(dir, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
  return file;
}

/** The store key of the notes store the app script serves (k.persist: `keel.store.<id>`). */
export const NOTES_KEY = "keel.store.t.notes";

export const field = (v: unknown, k: string): unknown =>
  typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;
