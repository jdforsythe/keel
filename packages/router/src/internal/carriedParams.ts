import { type KeelError, type Result, err, ok } from "@keel/schema";
import type { Def } from "./Def.ts";
import type { Rec } from "./Rec.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { unexpected } from "./unexpected.ts";

/**
 * The params a guard redirect to `id` (definition `target`) carries: each of its params fields, from the matched
 * route's params of the same name (k.guards). A field the matched route lacks is E1508: a `keel.unexpected` whose
 * message starts with the code.
 */
export function carriedParams(
  id: string,
  target: Def | undefined,
  matched: Rec,
): Result<Rec, KeelError<"keel.unexpected", Readonly<Record<string, never>>>> {
  const out: Record<string, unknown> = {};
  const fields = target?.params === undefined ? [] : fieldsOf(target.params.node);
  for (const [name] of fields) {
    if (!Object.hasOwn(matched, name) || matched[name] === undefined)
      return err(unexpected(`E1508 guard redirect to "${id}" needs param "${name}", which the matched route lacks`));
    out[name] = matched[name];
  }
  return ok(out);
}
