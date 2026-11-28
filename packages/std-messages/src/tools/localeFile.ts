import { type RuleDef, defineRule } from "@keel/check";
import type { Hit } from "./internal/Hit.ts";
import { dependsOn } from "./internal/dependsOn.ts";
import { editOf } from "./internal/editOf.ts";
import { findingsOf } from "./internal/findingsOf.ts";
import { localesOf } from "./internal/localesOf.ts";
import { msgOf } from "./internal/msgOf.ts";
import { setDecls } from "./internal/setDecls.ts";

/**
 * E2401 (std.messages): a locale of a set without `<Set>/<locale>.ts`, or `load` not
 * ``(locale) => import(`./<Set>/${locale}.ts`)`` (fix: that exact `load`). Reported on the set's `*.schema.ts` file.
 */
export const localeFile: RuleDef = defineRule({
  code: "E2401",
  see: "std.messages",
  message: msgOf,
  explain:
    "Each locale of a message set has its file <Set>/<locale>.ts, and load is the exact dynamic import, so each " +
    "locale is its own chunk. Fix: (locale) => import(`./RecipesText/${locale}.ts`).",
  check: ({ file, ast, project }) => {
    if (!file.path.endsWith(".schema.ts") || !dependsOn(file.path, project)) return [];
    const dir = file.path.slice(0, file.path.lastIndexOf("/") + 1);
    const hits: Hit[] = [];
    for (const set of setDecls(ast)) {
      const locales = set.locales === undefined ? undefined : localesOf(set.locales, file, ast, project);
      for (const l of locales ?? [])
        if (!project.some((f) => f.path === `${dir}${set.name}/${l}.ts`))
          hits.push({ at: set.at, msg: `locale '${l}' of ${set.name} has no file ${set.name}/${l}.ts` });
      const exact = `(locale) => import(\`./${set.name}/\${locale}.ts\`)`;
      const msg = `${set.name} load is not the import of ./${set.name}/\${locale}.ts`;
      if (set.load === undefined)
        hits.push({ at: set.at, msg, edit: { start: set.after, end: set.after, text: `, ${exact}` } });
      else if (!set.load.exact)
        hits.push({ at: set.load.start, msg, edit: { start: set.load.start, end: set.load.end, text: exact } });
    }
    return findingsOf(file, hits);
  },
  fix: editOf,
});
