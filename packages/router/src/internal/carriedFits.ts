import type { Def } from "./Def.ts";
import type { Located } from "./Located.ts";
import { codedError } from "./codedError.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { paramFits } from "./paramFits.ts";

/**
 * Throw E1508 for the first page of `located` whose chain holds a guard with `redirect` to a route of `defs` whose
 * params field the page lacks or carries a node that does not fit (k.guards Carried params, `paramFits`). A redirect
 * to a route `defs` lacks is left to the table that joins it; API entries redirect nowhere.
 */
export function carriedFits(located: readonly Located[], defs: ReadonlyMap<string, Def>): void {
  for (const { id, def, chain } of located) {
    if (def.kind !== "page") continue;
    const own = new Map(def.params === undefined ? [] : fieldsOf(def.params.node));
    for (const level of chain) {
      const to = level.def.guard?.redirect;
      const target = to === undefined ? undefined : defs.get(to);
      if (to === undefined || target?.params === undefined) continue;
      for (const [name, node] of fieldsOf(target.params.node)) {
        const mine = own.get(name);
        if (mine === undefined || !paramFits(mine, node))
          throw codedError(
            "E1508",
            `${id}: guard redirect to "${to}" carries param "${name}", ${mine === undefined ? "which the page lacks" : "which does not fit"}`,
          );
      }
    }
  }
}
