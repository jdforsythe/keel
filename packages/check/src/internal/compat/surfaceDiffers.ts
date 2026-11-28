import { canonicalJson } from "@keel/compiler/internal";
import { isRecord } from "./isRecord.ts";

const keys = (a: unknown, b: unknown): string[] =>
  [...new Set([...Object.keys(isRecord(a) ? a : {}), ...Object.keys(isRecord(b) ? b : {})])].sort();
const at = (x: unknown, k: string): unknown => (isRecord(x) ? x[k] : undefined);
const same = (a: unknown, b: unknown): boolean => canonicalJson(a ?? null) === canonicalJson(b ?? null);

/**
 * The first store, contract or entry in which two surfaces' data differ (k.derived Frozen): `store <id>`, else
 * `<entry id>` of a contract's entries, else `contract <module>`, else `version`; undefined when they are equal.
 */
export function surfaceDiffers(have: unknown, want: unknown): string | undefined {
  for (const id of keys(at(have, "stores"), at(want, "stores")))
    if (!same(at(at(have, "stores"), id), at(at(want, "stores"), id))) return `store ${id}`;
  for (const m of keys(at(have, "contracts"), at(want, "contracts"))) {
    const a = at(at(have, "contracts"), m);
    const b = at(at(want, "contracts"), m);
    if (same(a, b)) continue;
    for (const id of keys(at(a, "entries"), at(b, "entries")))
      if (!same(at(at(a, "entries"), id), at(at(b, "entries"), id))) return id;
    return `contract ${m}`;
  }
  return same(have, want) ? undefined : "version";
}
