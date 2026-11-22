import { codeError } from "../../internal/codeError.ts";
import type { Engine } from "./Engine.ts";
import { pgEngine } from "./pgEngine.ts";
import { pgliteEngine } from "./pgliteEngine.ts";

/** At most this many `pglite:` folders stay open in a process; the one used least recently and idle closes first. */
const OPEN_FOLDERS = 2;

type Open = { engine: Promise<Engine>; busy: number; used: number; readonly close: () => Promise<void> };
const engines = new Map<string, Open>();
let clock = 0;

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
export function engineFor(url: string | undefined): Promise<Engine> {
  if (url === undefined || url === "")
    throw codeError("E2455", "KEEL_POSTGRES_URL is not set; give it a postgres:, postgresql: or pglite: URL");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  if (scheme !== "postgres" && scheme !== "postgresql" && scheme !== "pglite")
    throw codeError("E2455", "KEEL_POSTGRES_URL is not a postgres:, postgresql: or pglite: URL");
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
          const db = await PGlite.create({ dataDir: url.slice("pglite:".length) });
          closer = () => db.close();
          return pgliteEngine(db);
        })
      : Promise.resolve(pgEngine(url));
  const open: Open = { engine: made, busy: 0, used: ++clock, close: () => closer?.() ?? Promise.resolve() };
  open.engine = made.then((e) => tracked(open, e));
  open.engine.catch(() => engines.delete(url));
  engines.set(url, open);
  return open.engine;
}
