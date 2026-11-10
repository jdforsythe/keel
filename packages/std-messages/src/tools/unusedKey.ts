import { type RuleDef, defineRule } from "@keel/check";
import type { Hit } from "./internal/Hit.ts";
import { dependsOn } from "./internal/dependsOn.ts";
import { editOf } from "./internal/editOf.ts";
import { findingsOf } from "./internal/findingsOf.ts";
import { memberNames } from "./internal/memberNames.ts";
import { msgOf } from "./internal/msgOf.ts";
import { parsed } from "./internal/parsed.ts";
import { removal } from "./internal/removal.ts";
import { setDecls } from "./internal/setDecls.ts";

/**
 * E2404 (std.messages): a declared key no other project file reads as `.<key>` (the set's own locale files aside).
 * Fix: removes it from the declaration. Reported on the set's `*.schema.ts` file.
 */
export const unusedKey: RuleDef = defineRule({
  code: "E2404",
  see: "std.messages",
  message: msgOf,
  explain:
    "Every declared message key is read somewhere as .<key>, such as props.data.text.title. Fix: remove the " +
    "key from messages(...); then remove it from each locale file (E2403).",
  check: ({ file, ast, project }) => {
    if (!file.path.endsWith(".schema.ts") || !dependsOn(file.path, project)) return [];
    const dir = file.path.slice(0, file.path.lastIndexOf("/") + 1);
    const hits: Hit[] = [];
    for (const set of setDecls(ast)) {
      const readers = project.filter((f) => f !== file && !f.path.startsWith(`${dir}${set.name}/`));
      const reads = (key: string): boolean =>
        readers.some((f) => {
          const p = parsed(f);
          return p !== undefined && memberNames(p).has(key);
        });
      for (const k of set.keys) {
        if (reads(k.name)) continue;
        const edit = removal(set.items, k.index)[0];
        const msg = `message key '${k.name}' of ${set.name} is never read`;
        hits.push(edit === undefined ? { at: k.start, msg } : { at: k.start, msg, edit });
      }
    }
    return findingsOf(file, hits);
  },
  fix: editOf,
});
