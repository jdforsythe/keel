import type { Expression, NewExpression } from "oxc-parser";
import { Visitor, parseSync } from "oxc-parser";

/** One `new URL(<first>, import.meta.url)` call: its first argument, the literal text it holds, and its offsets. */
export type UrlCall = {
  readonly first: Expression | undefined;
  /** The text of a string literal or of a template literal without an expression; undefined for any other form. */
  readonly name: string | undefined;
};

/** Whether `e` is `import.meta.url`. */
function isMetaUrl(e: Expression | undefined): boolean {
  return (
    e?.type === "MemberExpression" &&
    !e.computed &&
    e.object.type === "MetaProperty" &&
    e.object.meta.name === "import" &&
    e.object.property.name === "meta" &&
    e.property.type === "Identifier" &&
    e.property.name === "url"
  );
}

/** The text a first argument holds when it is a string literal or a template literal without an expression. */
function literalOf(e: Expression | undefined): string | undefined {
  if (e?.type === "Literal" && typeof e.value === "string") return e.value;
  if (e?.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/** The `new URL(<first>, import.meta.url)` calls of `source` (the file `file`), in source order. */
export function urlCalls(file: string, source: string): UrlCall[] {
  const out: UrlCall[] = [];
  const { program } = parseSync(file, source, { sourceType: "module" });
  new Visitor({
    NewExpression: (n: NewExpression) => {
      const [first, base] = n.arguments;
      if (n.callee.type !== "Identifier" || n.callee.name !== "URL" || base?.type === "SpreadElement") return;
      if (!isMetaUrl(base)) return;
      const arg = first?.type === "SpreadElement" ? undefined : first;
      out.push({ first: arg, name: literalOf(arg) });
    },
  }).visit(program);
  return out;
}
