import type { SchemaError } from "@keel/schema";
import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";

const clip = (v: string): string => (v.length > 24 ? `${v.slice(0, 21)}...` : v);

/**
 * E1052 per schema issue: a flag value invalid for the operation's input schema. `label` names the field
 * as the surface spells it (`--limit`, `argument id`, `limit`), `raw` gives the text the user passed.
 */
export function issueDiags(
  error: SchemaError,
  label: (field: string) => string,
  raw: (field: string) => string | undefined,
): Diag[] {
  return error.data.issues.map((i) => {
    const field = String(i.path[0] ?? "");
    const value = raw(field);
    const shown = value === undefined ? "" : ` ${JSON.stringify(clip(value))}`;
    return makeDiag("E1052", `${label(field)} value${shown} invalid (${i.rule})`, { see: "k.cli" });
  });
}
