import type { StringLiteral } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { ModuleContract } from "./ModuleContract.ts";
import { diagAt } from "./diagAt.ts";
import { literalPath } from "./literalPath.ts";
import { propertyOf } from "./propertyOf.ts";

type Shape = {
  readonly mc: ModuleContract;
  readonly id: string;
  readonly key: string;
  readonly at: StringLiteral;
  readonly method: string | null;
};

/** The path pattern with param names erased and a trailing slash dropped: equal keys collide. */
const keyOf = (path: string): string => {
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return trimmed
    .split("/")
    .map((s) => (s.startsWith(":") ? ":" : s))
    .join("/");
};

/** The page and API entries of `mc` with a literal path, an API entry's literal method upper-cased. */
function shapesOf(mc: ModuleContract): Shape[] {
  const out: Shape[] = [];
  for (const e of mc.contract.list) {
    if (e.obj === null || e.kind === "layout") continue;
    const p = literalPath(e.obj);
    if (p === null) continue;
    const m = propertyOf(e.obj, "method")?.value;
    const verb = m?.type === "Literal" && typeof m.value === "string" ? m.value.toUpperCase() : null;
    if (e.kind === "api" && verb === null) continue;
    out.push({ mc, id: e.id, key: keyOf(p.text), at: p.at, method: e.kind === "api" ? verb : null });
  }
  return out;
}

/**
 * E1502 (k.routes, k.api Paths), at the later entry's `path`: within each contract two entries on one path pattern
 * except API entries at different methods; within each deployable's table, entries of two modules on one pattern,
 * methods aside. Only literal paths are read.
 */
export function pathClashes(contracts: readonly ModuleContract[], tables: readonly ModuleContract[][]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const report = (s: Shape, other: Shape): void => {
    const message = `${s.id}: path pattern "${s.key}" is also ${other.id}'s`;
    out.push(diagAt(s.mc.contract.file, s.at.start, "E1502", message, "k.routes"));
  };
  for (const mc of contracts) {
    const seen: Shape[] = [];
    for (const s of shapesOf(mc)) {
      const other = seen.find(
        (o) => o.key === s.key && !(s.method !== null && o.method !== null && s.method !== o.method),
      );
      if (other !== undefined) report(s, other);
      seen.push(s);
    }
  }
  for (const table of tables) {
    const first = new Map<string, Shape>();
    for (const s of table.flatMap(shapesOf)) {
      const other = first.get(s.key);
      if (other === undefined) first.set(s.key, s);
      else if (other.mc !== s.mc) report(s, other);
    }
  }
  return out;
}
