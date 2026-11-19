import { type Result, err, ok } from "@keel/schema";
import type { RouteDef } from "../types/RouteDef.ts";
import type { Rec } from "./Rec.ts";
import { fieldsOf } from "./fieldsOf.ts";

/**
 * The params a guard redirect to `id` (definition `target`) carries: each of its params fields, from the matched
 * route's params of the same name (k.guards). A field the matched route lacks is E1508; the error is the
 * message, starting with the code.
 */
export function carriedParams(id: string, target: RouteDef | undefined, matched: Rec): Result<Rec, string> {
  const out: Record<string, unknown> = {};
  const fields = target?.params === undefined ? [] : fieldsOf(target.params.node);
  for (const [name] of fields) {
    if (!Object.hasOwn(matched, name) || matched[name] === undefined)
      return err(`E1508 guard redirect to "${id}" needs param "${name}", which the matched route lacks`);
    out[name] = matched[name];
  }
  return ok(out);
}
