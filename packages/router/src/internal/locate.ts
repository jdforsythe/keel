import type { Def } from "./Def.ts";
import type { Located } from "./Located.ts";
import type { Table } from "./Table.ts";
import { chainOf } from "./chainOf.ts";

/** The first binding on `id`'s chain whose `layout` `defs` lacks, with that layout: `<id>: layout "<layout>" ...`. */
function foreign(id: string, defs: ReadonlyMap<string, Def>): string {
  let at = id;
  for (let name = defs.get(id)?.layout; name !== undefined; name = defs.get(name)?.layout) {
    if (!defs.has(name)) return `${at}: layout "${name}" names no entry of the route table`;
    at = name;
  }
  return `${id}: layout names no entry of the route table`;
}

/**
 * The routes of `table` with a path, each with its chain (`chainOf`). With `module`, one module's table: a chain that
 * reaches a layout of another module leaves `open` set to the E1506 message naming the first such binding and layout, and that route unlocated.
 */
export function locate(
  table: Table,
  module?: string,
): { readonly located: readonly Located[]; readonly open?: string } {
  const defs = new Map<string, Def>();
  for (const [id, r] of table) defs.set(id, r.def);
  const located: Located[] = [];
  let open: string | undefined;
  for (const [id, { def }] of table) {
    const chain = module === undefined ? chainOf(id, defs) : chainOf(id, defs, module);
    if (chain === null) open ??= foreign(id, defs);
    else if (def.segments !== null) located.push({ id, def, segments: def.segments, chain });
  }
  return open === undefined ? { located } : { located, open };
}
