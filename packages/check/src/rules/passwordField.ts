import { clipMessage } from "@keel/schema/internal";
import type { Argument, CallExpression, Expression, ObjectExpression } from "oxc-parser";
import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { jsxLiteral } from "../internal/jsxLiteral.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { namespaceNames } from "../internal/modules/namespaceNames.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { schemaNodeAt } from "../internal/schemaNodeAt.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The `autocomplete` tokens of a password control. */
const PASSWORD_TOKENS: ReadonlySet<string> = new Set(["current-password", "new-password"]);

/** Whether a literal `type` and `autocomplete` mark a password control. */
const isPassword = (type: string | null | undefined, autocomplete: string | null | undefined): boolean =>
  type === "password" ||
  (typeof autocomplete === "string" && autocomplete.split(/\s+/).some((t) => PASSWORD_TOKENS.has(t)));

/** Whether `callee` is `name` imported from `source`, or `<ns>.name` of a namespace import of it. */
function calls(callee: Expression, names: ReadonlySet<string>, spaces: ReadonlySet<string>, name: string): boolean {
  if (callee.type === "Identifier") return names.has(callee.name);
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    spaces.has(callee.object.name) &&
    callee.property.name === name
  );
}

/** `{ form, path }` of a `f.field('<literal path>')` call, or null. */
function fieldCall(e: Argument | null | undefined): { form: string; path: string } | null {
  if (e?.type !== "CallExpression") return null;
  const c = e.callee;
  const arg = e.arguments[0];
  if (c.type !== "MemberExpression" || c.computed || c.property.name !== "field" || c.object.type !== "Identifier")
    return null;
  if (arg?.type !== "Literal" || typeof arg.value !== "string") return null;
  return { form: c.object.name, path: arg.value };
}

/** A literal string property of an object literal: its text, `null` for another value, `undefined` when absent. */
function literalProp(obj: ObjectExpression, name: string): string | null | undefined {
  const v = propertyOf(obj, name)?.value;
  if (v === undefined) return undefined;
  return v.type === "Literal" && typeof v.value === "string" ? v.value : null;
}

/**
 * W1114 (k.privacy-reads): an `Input` (`@keel/ui`, JSX or a call with an object literal) with a literal `type`
 * `password`, or a literal `autocomplete` whose space-separated tokens hold `current-password` or `new-password`,
 * whose `field` is `f.field('<path>')`, `f` a `const` of the file bound to `form(<schema>, …)` (`@keel/forms`), where
 * the schema node at the path (`schemaNodeAt`) is a `s.<name>(…)` call other than `s.secret`. A step it cannot follow
 * reports nothing. No fix: `s.secret` also changes how the server reads the value.
 */
export const passwordField: RuleDef = {
  code: "W1114",
  message: (f) =>
    `password field '${clipMessage(str(f.data, "path"), 24)}' is not s.secret; it reaches logs as written`,
  see: "k.privacy-reads",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path)) return [];
    const inputs = localNames(ast, "Input", "@keel/ui");
    const uiSpaces = namespaceNames(ast, "@keel/ui");
    const formNames = localNames(ast, "form", "@keel/forms");
    const formSpaces = namespaceNames(ast, "@keel/forms");
    if ((inputs.size === 0 && uiSpaces.size === 0) || (formNames.size === 0 && formSpaces.size === 0)) return [];
    // `const f = form(schema, …)` anywhere in the file, by name; a name bound to two forms is not read.
    const forms = new Map<string, Argument | null>();
    const controls: { at: number; form: string; path: string }[] = [];
    new Visitor({
      VariableDeclaration: (d) => {
        if (d.kind !== "const") return;
        for (const v of d.declarations) {
          if (v.id.type !== "Identifier" || v.init?.type !== "CallExpression") continue;
          if (!calls(v.init.callee, formNames, formSpaces, "form")) continue;
          const schema = v.init.arguments[0] ?? null;
          forms.set(v.id.name, forms.has(v.id.name) ? null : schema);
        }
      },
      JSXOpeningElement: (o) => {
        const n = o.name;
        const isInput =
          n.type === "JSXIdentifier"
            ? inputs.has(n.name)
            : n.type === "JSXMemberExpression" &&
              n.object.type === "JSXIdentifier" &&
              uiSpaces.has(n.object.name) &&
              n.property.name === "Input";
        if (!isInput) return;
        if (!isPassword(jsxLiteral(o.attributes, "type")?.text, jsxLiteral(o.attributes, "autocomplete")?.text)) return;
        for (const a of o.attributes) {
          if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== "field") continue;
          const v = a.value?.type === "JSXExpressionContainer" ? a.value.expression : null;
          const fc = v === null || v.type === "JSXEmptyExpression" ? null : fieldCall(v);
          if (fc !== null) controls.push({ at: o.start, ...fc });
        }
      },
      CallExpression: (call: CallExpression) => {
        if (!calls(call.callee, inputs, uiSpaces, "Input")) return;
        const obj = call.arguments[0];
        if (obj?.type !== "ObjectExpression") return;
        if (!isPassword(literalProp(obj, "type"), literalProp(obj, "autocomplete"))) return;
        const fc = fieldCall(propertyOf(obj, "field")?.value);
        if (fc !== null) controls.push({ at: call.start, ...fc });
      },
    }).visit(ast);
    const out: Finding[] = [];
    for (const c of controls) {
      const schema = forms.get(c.form);
      if (schema === undefined || schema === null) continue;
      const node = schemaNodeAt(schema, file, project, c.path.split("."));
      if (node !== null && node !== "secret") out.push(findingAt(file, c.at, { path: c.path }));
    }
    return out;
  },
};
