import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { namespaceNames } from "../internal/modules/namespaceNames.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1106 (k.schema): `s.format` in app code. Reported at each `<s>.format` member, `<s>` a local name bound to `s`
 * from `@keel/schema` (renamed imports too) or `<ns>.s` of a namespace import. No fix: the app uses a stdlib format
 * type instead, which is a choice of type, not an edit. `check()` drops the finding in a library's `src/` and `unsafe/`
 * files, where `s.format` declares the library's format types (k.formats Who declares).
 */
export const formatInApp: RuleDef = {
  code: "E1106",
  message: () => "`s.format` in app code; use a library's format type",
  see: "k.schema",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const names = localNames(ast, "s", "@keel/schema");
    const namespaces = namespaceNames(ast, "@keel/schema");
    if (names.size === 0 && namespaces.size === 0) return [];
    const at: number[] = [];
    new Visitor({
      MemberExpression: (n) => {
        if (n.computed || n.property.type !== "Identifier" || n.property.name !== "format") return;
        const o = n.object;
        if (o.type === "Identifier" && names.has(o.name)) at.push(n.start);
        else if (
          o.type === "MemberExpression" &&
          !o.computed &&
          o.object.type === "Identifier" &&
          namespaces.has(o.object.name) &&
          o.property.type === "Identifier" &&
          o.property.name === "s"
        )
          at.push(n.start);
      },
    }).visit(ast);
    return at.map((start) => findingAt(file, start));
  },
};
