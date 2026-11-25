import { type Edit, type Finding, type RuleDef, defineRule } from "@keel/check";
import { attempt } from "@keel/schema";
import { exactKey } from "../internal/exactKey.ts";
import { clip } from "./internal/clip.ts";
import { inLocaleFile } from "./internal/inLocaleFile.ts";
import { keyOf } from "./internal/keyOf.ts";
import { lineCol } from "./internal/lineCol.ts";
import { msgOf } from "./internal/msgOf.ts";
import { packEdits } from "./internal/packEdits.ts";
import { removals } from "./internal/removals.ts";
import { unpackEdits } from "./internal/unpackEdits.ts";
import { unwrap } from "./internal/unwrap.ts";

const CATEGORIES = ["zero", "one", "two", "few", "many"];

/** The plural categories `Intl.PluralRules` selects for `locale`; `undefined` for a tag it does not know. */
function selected(locale: string): readonly string[] | undefined {
  const r = attempt(() => new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
  return r.ok ? r.value : undefined;
}

/**
 * E2407 (std.messages): a plural form in a locale file that never applies: a category form the file's locale never
 * selects, or a key starting with `=` that is not an exact form. Fix: `zero` becomes `'=0'` (removed beside an `'=0'`);
 * another never-selected category form is removed; none for a malformed `=` key.
 */
export const neverApplies: RuleDef = defineRule({
  code: "E2407",
  see: "std.messages",
  message: msgOf,
  explain:
    "A plural form applies only where the file's locale selects its category (new Intl.PluralRules(locale)" +
    ".resolvedOptions().pluralCategories) or its exact number. Fix: write 'none yet' as '=0', not zero; remove " +
    "a category the locale never selects; write an exact form as '=' and a whole number, as '=12'.",
  check: (input) => {
    const e = inLocaleFile(input);
    if (e === undefined) return [];
    const live = selected(e.locale);
    const out: Finding[] = [];
    for (const { prop } of e.props) {
      const value = unwrap(prop.value);
      if (value.type !== "ObjectExpression") continue;
      const entries = value.properties.map((p, index) => ({ name: keyOf(p), index, p }));
      if (!entries.some((x) => x.name === "plural")) continue;
      const hasZeroExact = entries.some((x) => x.name === "=0");
      const drop: number[] = [];
      const rename: Edit[] = [];
      const dead: { readonly at: number; readonly msg: string }[] = [];
      for (const { name, index, p } of entries) {
        if (name === undefined || p.type !== "Property") continue;
        if (name.startsWith("=")) {
          if (!exactKey(name))
            out.push({
              path: input.file.path,
              ...lineCol(input.file.source, p.start),
              data: { msg: `'${clip(name)}' is not an exact plural form: = then a whole number, as '=0'` },
            });
          continue;
        }
        if (live === undefined || !CATEGORIES.includes(name) || live.includes(name)) continue;
        const toExact = name === "zero" && !hasZeroExact;
        if (toExact) rename.push({ start: p.key.start, end: p.key.end, text: "'=0'" });
        else drop.push(index);
        dead.push({
          at: p.start,
          msg: `plural form ${name} never applies in ${e.locale}${toExact ? "; '=0' matches 0" : ""}`,
        });
      }
      const items = value.properties.map((p) => ({ start: p.start, end: p.end }));
      const edits = [...rename, ...removals(items, drop)].sort((a, b) => a.start - b.start);
      // The first never-applying form of a message carries the fix for all of them, so one patch clears the message.
      dead.forEach((d, i) => {
        out.push({
          path: input.file.path,
          ...lineCol(input.file.source, d.at),
          data: { msg: d.msg, ...(i === 0 ? packEdits(edits) : {}) },
        });
      });
    }
    return out;
  },
  fix: unpackEdits,
});
