import type { Def } from "./Def.ts";
import type { Level } from "./Level.ts";
import { codedError } from "./codedError.ts";

/**
 * The chain of route `id` in `defs`: the layouts its binding names, outermost first, then the route. A `layout` that
 * names no entry of `defs`, names an entry that is no layout, or closes a cycle throws E1506 naming the ids. With
 * `module`, a `layout` of another module's contract that `defs` lacks ends the walk instead: the chain is `null` until
 * the tables are joined (`routeTable`).
 */
export function chainOf(id: string, defs: ReadonlyMap<string, Def>): readonly Level[];
export function chainOf(id: string, defs: ReadonlyMap<string, Def>, module: string): readonly Level[] | null;
export function chainOf(id: string, defs: ReadonlyMap<string, Def>, module?: string): readonly Level[] | null {
  const def = defs.get(id);
  if (def === undefined) return [];
  const out: Level[] = [{ id, def }];
  const seen: string[] = [id];
  for (let at = id, name = def.layout; name !== undefined; ) {
    if (seen.includes(name)) throw codedError("E1506", `${id}: layout cycle ${[...seen, name].join(" in ")}`);
    seen.push(name);
    const next = defs.get(name);
    if (next === undefined && module !== undefined && !name.startsWith(`${module}.`)) return null;
    if (next === undefined) throw codedError("E1506", `${at}: layout "${name}" names no entry of the route table`);
    if (next.kind !== "layout") throw codedError("E1506", `${at}: layout "${name}" is a ${next.kind} entry, no layout`);
    out.unshift({ id: name, def: next });
    at = name;
    name = next.layout;
  }
  return out;
}
