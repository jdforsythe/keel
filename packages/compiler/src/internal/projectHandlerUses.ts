import path from "node:path";
import type { Program } from "oxc-parser";
import type { HandlerKind } from "./HandlerKind.ts";
import type { HandlerUse } from "./HandlerUse.ts";
import { ROUTER_HANDLERS } from "./ROUTER_HANDLERS.ts";
import { handlerUses } from "./handlerUses.ts";

const EXT = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cts", ".cjs", "/index.ts", "/index.tsx", "/index.js"];
const ROUTER = /^@keel\/router(?:\/|$)/;

/**
 * The handler uses of every file of a project (k.bundle Handlers; `handlerUses`), the one definition E1551, E1009 and
 * E1007 `handler` read. `@keel/router` and any subpath of it export the three handlers; a file of the project exports
 * the ones it re-exports, followed through relative specifiers (paths joined with `/`, a query dropped) until nothing
 * changes, so `lib/r.ts` re-exporting `loader` makes `loader` imported from it a handler too.
 */
export function projectHandlerUses(
  files: readonly { readonly path: string; readonly program: Program }[],
): ReadonlyMap<string, readonly HandlerUse[]> {
  const byPath = new Map(files.map((f) => [f.path, f]));
  let exported = new Map<string, ReadonlyMap<string, HandlerKind>>();
  const originFor =
    (from: string, table: ReadonlyMap<string, ReadonlyMap<string, HandlerKind>>) =>
    (source: string): ReadonlyMap<string, HandlerKind> | undefined => {
      if (ROUTER.test(source)) return ROUTER_HANDLERS;
      if (!source.startsWith(".")) return undefined;
      const at = path.posix.join(path.posix.dirname(from), source.split("?")[0] ?? source);
      const file = EXT.map((e) => at + e).find((c) => byPath.has(c));
      const map = file === undefined ? undefined : table.get(file);
      return map === undefined || map.size === 0 ? undefined : map;
    };
  const sig = (t: ReadonlyMap<string, ReadonlyMap<string, HandlerKind>>): string =>
    [...t].map(([p, m]) => `${p}:${[...m].map(([k, v]) => `${k}=${v}`).join(",")}`).join(";");
  for (let round = 0; round <= files.length; round++) {
    const next = new Map<string, ReadonlyMap<string, HandlerKind>>();
    for (const f of files) {
      const e = handlerUses(f.program, originFor(f.path, exported)).exports;
      if (e.size > 0) next.set(f.path, e);
    }
    const same = sig(next) === sig(exported);
    exported = next;
    if (same) break;
  }
  return new Map(files.map((f) => [f.path, handlerUses(f.program, originFor(f.path, exported)).uses]));
}
