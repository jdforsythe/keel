import { Visitor } from "oxc-parser";
import type { Expression, JSXAttributeItem, ObjectExpression } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { BASE_ELEMENTS } from "./BASE_ELEMENTS.ts";
import type { Checked } from "./Checked.ts";
import { keyName } from "./keyName.ts";
import { moduleDiag } from "./modules/moduleDiag.ts";

/** The packages whose elements E1161 judges, and the names it judges from each. */
const SOURCES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["@keel/ui", BASE_ELEMENTS],
  ["@keel/ui/aria", new Set(["Part"])],
]);

/** Whether an `id` value is a string literal or a template literal without an expression (`x as T` and `(x)` read through). */
function literal(e: Expression): boolean {
  let x = e;
  while (x.type === "TSAsExpression" || x.type === "TSSatisfiesExpression" || x.type === "ParenthesizedExpression")
    x = x.expression;
  return (
    (x.type === "Literal" && typeof x.value === "string") ||
    (x.type === "TemplateLiteral" && x.expressions.length === 0)
  );
}

/** `bad` when the JSX attributes give no `id` and no spread, or a literal one; `ok` otherwise. */
function jsxId(attributes: readonly JSXAttributeItem[]): boolean {
  let spread = false;
  for (const a of attributes) {
    if (a.type === "JSXSpreadAttribute") {
      spread = true;
      continue;
    }
    if (a.name.type !== "JSXIdentifier" || a.name.name !== "id") continue;
    const v = a.value;
    if (v === null || v.type === "Literal") return true;
    if (v.type === "JSXExpressionContainer") return v.expression.type !== "JSXEmptyExpression" && literal(v.expression);
    return false;
  }
  return !spread;
}

/** The same for the object a call passes: no `id` and no spread, or a literal one. */
function objectId(o: ObjectExpression): boolean {
  let spread = false;
  for (const p of o.properties) {
    if (p.type !== "Property") {
      spread = true;
      continue;
    }
    if (keyName(p) === "id") return literal(p.value);
  }
  return !spread;
}

/**
 * E1161 (k.library Ids): in each library file (`isLibrary`), each element of `@keel/ui`'s base elements (`Host` among
 * them) and `@keel/ui/aria`'s `Part`, rendered as JSX or called, whose `id` is missing, a string literal or a template
 * literal without an expression; aliases and namespace imports followed. An element with a spread and no `id`, and a
 * call whose argument is no object literal, are not judged. At the element's name; no fix.
 */
export function libraryIds(checked: readonly Checked[], isLibrary: (path: string) => boolean): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const { file, parsed } of checked) {
    if (!isLibrary(file.path)) continue;
    const locals = new Map<string, string>();
    const spaces = new Map<string, ReadonlySet<string>>();
    for (const st of parsed.program.body) {
      if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
      const names = SOURCES.get(st.source.value);
      if (names === undefined) continue;
      for (const sp of st.specifiers) {
        if (sp.type === "ImportNamespaceSpecifier") spaces.set(sp.local.name, names);
        else if (sp.type === "ImportSpecifier" && sp.importKind !== "type") {
          const imported = sp.imported.type === "Identifier" ? sp.imported.name : String(sp.imported.value);
          if (names.has(imported)) locals.set(sp.local.name, imported);
        }
      }
    }
    if (locals.size === 0 && spaces.size === 0) continue;
    const member = (o: string, p: string): string | undefined => (spaces.get(o)?.has(p) === true ? p : undefined);
    const report = (name: string, at: number): void =>
      void out.push(
        moduleDiag("E1161", file, at, `<${name}> in a library takes an id built from props.id`, undefined, "k.library"),
      );
    new Visitor({
      JSXOpeningElement: (o) => {
        const n = o.name;
        const name =
          n.type === "JSXIdentifier"
            ? locals.get(n.name)
            : n.type === "JSXMemberExpression" && n.object.type === "JSXIdentifier"
              ? member(n.object.name, n.property.name)
              : undefined;
        if (name !== undefined && jsxId(o.attributes)) report(name, n.start);
      },
      CallExpression: (n) => {
        const c = n.callee;
        const name =
          c.type === "Identifier"
            ? locals.get(c.name)
            : c.type === "MemberExpression" &&
                !c.computed &&
                c.object.type === "Identifier" &&
                c.property.type === "Identifier"
              ? member(c.object.name, c.property.name)
              : undefined;
        if (name === undefined) return;
        const arg = n.arguments[0];
        if (arg === undefined || (arg.type === "ObjectExpression" && objectId(arg))) report(name, c.start);
      },
    }).visit(parsed.program);
  }
  return out;
}
