import { type RuleDef, defineRule } from "@keel/check";
import { copyHits } from "./internal/copyHits.ts";
import { dependsOn } from "./internal/dependsOn.ts";
import { findingsOf } from "./internal/findingsOf.ts";
import { msgOf } from "./internal/msgOf.ts";

const COMPONENT = /(?:^|\/)[A-Z][A-Za-z0-9]*\.[jt]sx$/;

/**
 * E2406 (std.messages): a JSX text child, a string literal `label` or `alt`, or a string literal a route `title`
 * returns, containing a letter, in a component or `routes.ts` file. No fix: the text belongs in a message set.
 */
export const literalCopy: RuleDef = defineRule({
  code: "E2406",
  see: "std.messages",
  message: msgOf,
  explain:
    "Text a person reads comes from a message set in loader data, so each locale gets its own. No fix. " +
    "<h1>Recipes</h1> -> <h1>{props.data.text.title}</h1>.",
  check: ({ file, ast, project }) => {
    const component = COMPONENT.test(file.path) && ast.body.some((s) => s.type === "ExportDefaultDeclaration");
    const routes = file.path === "routes.ts" || file.path.endsWith("/routes.ts");
    if ((!component && !routes) || !dependsOn(file.path, project)) return [];
    return findingsOf(file, copyHits(ast, component));
  },
});
