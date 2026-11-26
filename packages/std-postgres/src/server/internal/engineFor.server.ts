import { attempt } from "@keel/schema";
import type { Engine } from "./Engine.ts";
import { pgEngine } from "./pgEngine.server.ts";
import { pgliteEngine } from "./pgliteEngine.server.ts";
import { pgliteModules } from "./pgliteModules.server.ts";
import { schemeOf } from "./schemeOf.server.ts";

/** At most this many `pglite:` folders stay open in a process; the one used least recently and idle closes first. */
const OPEN_FOLDERS = 2;

type Open = { engine: Promise<Engine>; busy: number; used: number; readonly close: () => Promise<void> };
/**
 * Shared by every evaluation of this module in the process: a `keel dev` reload evaluates it again, and the new
 * evaluation reuses the folders and pools the last one opened instead of opening them a second time.
 */
const KEY = Symbol.for("keel.postgres.engines");

function sharedEngines(): Map<string, Open> {
  const shared: unknown = Reflect.get(globalThis, KEY);
  if (shared instanceof Map) return shared;
  const made = new Map<string, Open>();
  Reflect.set(globalThis, KEY, made);
  return made;
}

const engines = sharedEngines();
let clock = Math.max(0, ...[...engines.values()].map((o) => o.used));

const tracked = (open: Open, engine: Engine): Engine => {
  const around = async <T>(work: () => Promise<T>): Promise<T> => {
    open.busy++;
    open.used = ++clock;
    try {
      return await work();
    } finally {
      open.busy--;
    }
  };
  return {
    types: engine.types,
    statement: (text, params) => around(() => engine.statement(text, params)),
    tx: (level, fn) => around(() => engine.tx(level, fn)),
  };
};

/** Closes idle `pglite:` folders past `OPEN_FOLDERS`, least recently used first; a later query opens one again. */
function evict(): void {
  const folders = [...engines.entries()].filter(([u]) => u.startsWith("pglite:"));
  if (folders.length < OPEN_FOLDERS) return;
  folders.sort((a, b) => a[1].used - b[1].used);
  for (const [u, o] of folders.slice(0, folders.length - OPEN_FOLDERS + 1)) {
    if (o.busy > 0) continue;
    engines.delete(u);
    void o.close();
  }
}

/**
 * The engine for `KEEL_POSTGRES_URL`'s value (std.postgres Modes), one per URL per process: `postgres:` and
 * `postgresql:` use `pg`; `pglite:<folder>` PGlite on disk, loaded by `import()` only then. A missing value or another
 * scheme throws E2455, naming no part of the value.
 */
export function engineFor(value: string | undefined): Promise<Engine> {
  const { url, scheme } = schemeOf(value);
  const found = engines.get(url);
  if (found !== undefined) {
    found.used = ++clock;
    return found.engine;
  }
  if (scheme === "pglite") evict();
  let closer: (() => Promise<void>) | undefined;
  const made: Promise<Engine> =
    scheme === "pglite"
      ? import("@electric-sql/pglite").then(async ({ PGlite }) => {
          const db = await PGlite.create({ dataDir: url.slice("pglite:".length), ...(await pgliteModules()) });
          closer = () => db.close();
          return pgliteEngine(db);
        })
      : Promise.resolve(pgEngine(url));
  // A folder evicted while it is still opening closes once it has opened, so no second PGlite holds the folder.
  const close = async (): Promise<void> => {
    void (await attempt(() => made));
    await closer?.();
  };
  const open: Open = { engine: made, busy: 0, used: ++clock, close };
  open.engine = made.then((e) => tracked(open, e));
  void attempt(() => open.engine).then((r) => {
    if (!r.ok) engines.delete(url);
  });
  engines.set(url, open);
  return open.engine;
}
