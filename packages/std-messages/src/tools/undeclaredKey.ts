import { type RuleDef, defineRule } from "@keel/check";
import { editOf } from "./internal/editOf.ts";
import { findingsOf } from "./internal/findingsOf.ts";
import { inLocaleFile } from "./internal/inLocaleFile.ts";
import { msgOf } from "./internal/msgOf.ts";
import { removal } from "./internal/removal.ts";

/** E2403 (std.messages): a locale file key its set does not declare (fix: removes it). */
export const undeclaredKey: RuleDef = defineRule({
  code: "E2403",
  see: "std.messages",
  message: msgOf,
  explain:
    "A locale file holds only the keys its set declares; the entry is a closed object. Fix: remove the key, " +
    "or declare it in the set: messages(AppLocale, { extra: {} }, load).",
  check: (input) => {
    const e = inLocaleFile(input);
    if (e === undefined) return [];
    const declared = new Set(e.set.keys.map((k) => k.name));
    const items = e.obj.properties.map((p) => ({ start: p.start, end: p.end }));
    const hits = e.props
      .filter((p) => !declared.has(p.name))
      .map((p) => ({
        at: p.prop.start,
        msg: `${e.set.name} declares no key '${p.name}'`,
        edit: removal(items, p.index)[0],
      }))
      .map(({ edit, ...h }) => (edit === undefined ? h : { ...h, edit }));
    return findingsOf(input.file, hits);
  },
  fix: editOf,
});
