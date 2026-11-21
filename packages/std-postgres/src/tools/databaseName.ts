import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { field } from "./internal/field.ts";
import { importedAs } from "./internal/importedAs.ts";
import { lineCol } from "./internal/lineCol.ts";
import { walk } from "./internal/walk.ts";

const MODULE = /(?:^|\/)modules\/([^/]+)\//;
const SEGMENT = /^[a-z][A-Za-z0-9]*$/;

/**
 * E2458 (std.postgres, k.check registry): a `database` call (from `@keel/std-postgres/server`) whose name is not a
 * string literal `<moduleId>.<name>` of the module the file is in, `<name>` one lowerCamel segment (k.data E1607).
 * One finding per call. No fix.
 */
export const databaseName: RuleDef = defineRule({
  code: "E2458",
  see: "std.postgres",
  message: "a database name is not a literal '<moduleId>.<name>' of its module",
  explain:
    "A database capability's name is addressable and unique: the module id, a dot and one lowerCamel segment, " +
    "written as a string literal, as k.data's E1607 asks of register. Fix: database('kitchen.db', ...) in modules/kitchen/.",
  check: ({ file, ast }): Finding[] => {
    const locals = importedAs(ast, "@keel/std-postgres/server", "database");
    if (locals.size === 0) return [];
    const id = MODULE.exec(file.path)?.[1];
    const out: Finding[] = [];
    walk(ast.body, (n) => {
      const callee = field(n, "callee");
      if (field(n, "type") !== "CallExpression" || field(callee, "type") !== "Identifier") return;
      if (!locals.has(String(field(callee, "name")))) return;
      const args = field(n, "arguments");
      const first: unknown = Array.isArray(args) ? args[0] : undefined;
      const value = field(first, "type") === "Literal" ? field(first, "value") : undefined;
      const [mod, name, ...rest] = typeof value === "string" ? value.split(".") : [];
      if (id !== undefined && mod === id && name !== undefined && SEGMENT.test(name) && rest.length === 0) return;
      const at = field(first ?? n, "start");
      out.push({ path: file.path, ...lineCol(file.source, typeof at === "number" ? at : 0) });
    });
    return out;
  },
});
