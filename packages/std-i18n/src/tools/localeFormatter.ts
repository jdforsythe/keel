import { defineRule } from "@keel/check";
import type { RuleDef } from "@keel/check";
import { dependsOn } from "./internal/dependsOn.ts";
import { lineCol } from "./internal/lineCol.ts";
import { localeCalls } from "./internal/localeCalls.ts";

const PKG = "@keel/std-i18n";

/**
 * E2301 (std.i18n, k.check registry): in a module whose `deps` list `@keel/std-i18n`, an `Intl` formatter
 * constructed, or `toLocale*String` or `localeCompare` called, with a locale argument. The message names the stdlib
 * function to call. No fix: the function and its arguments depend on the value.
 */
export const localeFormatter: RuleDef = defineRule({
  code: "E2301",
  see: "std.i18n",
  message: (f) => `${String(f.data?.what ?? "Intl")} with a locale; use ${String(f.data?.use ?? "formatNumber")}`,
  explain:
    "Text for a person goes through the stdlib formatters, which take the route's Locale. " +
    "Fix: new Intl.NumberFormat(locale).format(n) -> formatNumber(n, locale).",
  check: ({ file, ast, project }) =>
    dependsOn(file.path, project, PKG)
      ? localeCalls(ast).map((c) => ({
          path: file.path,
          ...lineCol(file.source, c.start),
          data: { what: c.what, use: c.use },
        }))
      : [],
});
