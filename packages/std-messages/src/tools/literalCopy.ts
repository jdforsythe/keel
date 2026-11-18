import { type RuleDef, defineRule } from "@keel/check";
import { copyHits } from "./internal/copyHits.ts";
import { dependsOn } from "./internal/dependsOn.ts";
import { findingsOf } from "./internal/findingsOf.ts";
import { localeFileOf } from "./internal/localeFileOf.ts";
import { msgOf } from "./internal/msgOf.ts";

/** Not read: tests, tool configs, `unsafe/`, `.keel/` and `node_modules/`. */
const SKIP =
  /(?:^|\/)(?:test|tests|conformance|__tests__|unsafe|\.keel|node_modules)\/|\.(?:test|spec|config)\.[cm]?[jt]sx?$/;

/**
 * E2406 (std.copy): literal copy in an app file of a module listing the package, other than the set's locale files:
 * JSX text and child expressions and the listed attributes in `.tsx` files, the listed properties of an uppercase
 * call's object literal, and what a route `title` returns in `routes.ts` (`copyHits`). No fix: the text belongs in a
 * message set.
 */
export const literalCopy: RuleDef = defineRule({
  code: "E2406",
  see: "std.copy",
  message: msgOf,
  explain:
    "Text a person reads comes from a message set in loader data, so each locale gets its own. No fix. " +
    "<h1>Recipes</h1> -> <h1>{props.data.text.title}</h1>.",
  check: ({ file, ast, project }) => {
    if (SKIP.test(file.path) || !dependsOn(file.path, project) || localeFileOf(file.path, project) !== undefined)
      return [];
    return findingsOf(file, copyHits(ast, file.path, project));
  },
});
