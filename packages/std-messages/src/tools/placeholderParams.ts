import { type RuleDef, defineRule } from "@keel/check";
import { editOf } from "./internal/editOf.ts";
import { findingsOf } from "./internal/findingsOf.ts";
import { inLocaleFile } from "./internal/inLocaleFile.ts";
import { msgOf } from "./internal/msgOf.ts";
import { paramHits } from "./internal/paramHits.ts";

/**
 * E2405 (std.messages): a template's `{name}`, `plural` or `select` that does not match its key's params (fix: renames
 * the placeholder when exactly one declared param is absent from that template).
 */
export const placeholderParams: RuleDef = defineRule({
  code: "E2405",
  see: "std.messages",
  message: msgOf,
  explain:
    "A template names only its key's params: {name}, plural over a number param, select over an enum param with " +
    "a case per value. Fix: total: { text: 'Summe {m}' } -> { text: 'Summe {n}' }.",
  check: (input) => {
    const e = inLocaleFile(input);
    if (e === undefined) return [];
    const params = new Map(e.set.keys.map((k) => [k.name, k.params]));
    const hits = e.props.flatMap((p) => {
      const declared = params.get(p.name);
      return declared === undefined ? [] : paramHits(p.name, p.prop.value, declared);
    });
    return findingsOf(input.file, hits);
  },
  fix: editOf,
});
