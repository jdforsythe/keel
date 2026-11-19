import { type RuleDef, defineRule } from "@keel/check";
import { findingsOf } from "./internal/findingsOf.ts";
import { inLocaleFile } from "./internal/inLocaleFile.ts";
import { msgOf } from "./internal/msgOf.ts";

/** E2402 (std.messages): a locale file without a key its set declares. No fix: a translation cannot be derived. */
export const missingMessage: RuleDef = defineRule({
  code: "E2402",
  see: "std.messages",
  message: msgOf,
  explain:
    "A locale file gives every key of its set a message. No fix: a translation cannot be derived, and another " +
    "locale's text would ship the wrong language. Add the key: count: { plural: 'n', other: '# Rezepte' }.",
  check: (input) => {
    const e = inLocaleFile(input);
    if (e === undefined) return [];
    const have = new Set(e.props.map((p) => p.name));
    const hits = e.set.keys
      .filter((k) => !have.has(k.name))
      .map((k) => ({ at: e.obj.start, msg: `${e.set.name}/${e.locale}.ts lacks message '${k.name}'` }));
    return findingsOf(input.file, hits);
  },
});
