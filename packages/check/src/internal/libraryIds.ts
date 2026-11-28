import { type Argument, type Expression, type JSXAttributeItem, Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { BASE_ELEMENTS } from "./BASE_ELEMENTS.ts";
import type { Checked } from "./Checked.ts";
import { idReader } from "./idReader.ts";
import { moduleDiag } from "./modules/moduleDiag.ts";

/** The packages whose elements E1161 judges, and the names it judges from each. */
const SOURCES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["@keel/ui", BASE_ELEMENTS],
  ["@keel/ui/aria", new Set(["Part"])],
]);

/** The text of a string literal, or of a template literal with no substitution; undefined for any other expression. */
function literalText(e: Expression | null | undefined): string | undefined {
  if (e?.type === "Literal" && typeof e.value === "string") return e.value;
  if (e?.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/** A JSX element's literal `id` (its last `id` attribute, no spread after it), else undefined. */
function jsxLiteral(attrs: readonly JSXAttributeItem[]): string | undefined {
  let text: string | undefined;
  for (const a of attrs) {
    if (a.type === "JSXSpreadAttribute") text = undefined;
    else if (a.name.type === "JSXIdentifier" && a.name.name === "id")
      text =
        a.value?.type === "Literal"
          ? literalText(a.value)
          : a.value?.type === "JSXExpressionContainer" && a.value.expression.type !== "JSXEmptyExpression"
            ? literalText(a.value.expression)
            : undefined;
  }
  return text;
}

/** A call's first argument's literal `id` (an object literal, its last `id` property, no spread after it), else undefined. */
function callLiteral(arg: Argument | undefined): string | undefined {
  if (arg?.type !== "ObjectExpression") return undefined;
  let text: string | undefined;
  for (const p of arg.properties) {
    if (p.type === "SpreadElement") text = undefined;
    else if (!p.computed && p.key.type === "Identifier" && p.key.name === "id") text = literalText(p.value);
  }
  return text;
}

/** Whether `text` is `<id>.<rest>`, `<rest>` not empty. */
const inSpace = (text: string | undefined, id: string | undefined): boolean =>
  text !== undefined && id !== undefined && text.length > id.length + 1 && text.startsWith(`${id}.`);

/**
 * E1161 (k.library Ids): in each library file (`isLibrary`), each element of `@keel/ui`'s base elements (`Host` among
 * them) and `@keel/ui/aria`'s `Part`, rendered as JSX or called, whose `id` the reader (`idReader`, over the checked
 * files and the libraries' `entries`) cannot read as built from its component's `id` prop; aliases and namespace
 * imports followed. In a library's route component file (`pages`, each to its library's manifest `id`,
 * `routeComponents`, k.library-pages), an `id` that is a string literal `<id>.<rest>` is read as built too. At the element's name; no fix.
 */
export function libraryIds(
  checked: readonly Checked[],
  isLibrary: (path: string) => boolean,
  entries: ReadonlyMap<string, string> = new Map(),
  pages: ReadonlyMap<string, string> = new Map(),
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const reader = idReader(
    checked.map((c) => c.file),
    entries,
  );
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
    const page = pages.get(file.path);
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
        if (name === undefined || inSpace(jsxLiteral(o.attributes), page)) return;
        if (reader.jsxBad(o.attributes, file)) report(name, n.start);
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
        if (name === undefined || inSpace(callLiteral(n.arguments[0]), page)) return;
        if (reader.callBad(n.arguments[0], file)) report(name, c.start);
      },
    }).visit(parsed.program);
  }
  return out;
}
