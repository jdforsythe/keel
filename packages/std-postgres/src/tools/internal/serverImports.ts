import type { RuleInput } from "@keel/check";

const SERVER = "@keel/std-postgres/server";

const isNode = (x: unknown): x is object => typeof x === "object" && x !== null;

/** The literal text of an `import()` source: a string, or a template with no expression; `undefined` otherwise. */
function literal(src: object): unknown {
  if ("type" in src && src.type === "Literal" && "value" in src) return src.value;
  if (!("type" in src) || src.type !== "TemplateLiteral" || !("expressions" in src) || !("quasis" in src))
    return undefined;
  if (!Array.isArray(src.expressions) || src.expressions.length > 0 || !Array.isArray(src.quasis)) return undefined;
  return Reflect.get(Object(Reflect.get(Object(src.quasis[0]), "value")), "cooked");
}

/** Push the offset of each `import("@keel/std-postgres/server")` under `node`, at any depth. */
function dynamic(node: unknown, out: number[], seen: WeakSet<object>): void {
  if (!isNode(node) || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const n of node) dynamic(n, out, seen);
    return;
  }
  if ("type" in node && node.type === "ImportExpression" && "source" in node && isNode(node.source)) {
    const src = node.source;
    if (literal(src) === SERVER && "start" in src && typeof src.start === "number") out.push(src.start);
  }
  for (const v of Object.values(node)) dynamic(v, out, seen);
}

/**
 * The offset of each import or re-export of `@keel/std-postgres/server` in a file: top-level declarations, and
 * `import()` of that string at any depth. A type-only declaration loads nothing, so it is not counted.
 */
export function serverImports(ast: RuleInput["ast"]): number[] {
  const out: number[] = [];
  for (const st of ast.body) {
    const from =
      st.type === "ImportDeclaration"
        ? st.importKind === "type"
          ? null
          : st.source
        : st.type === "ExportAllDeclaration" || st.type === "ExportNamedDeclaration"
          ? st.exportKind === "type"
            ? null
            : st.source
          : null;
    if (from !== null && from.value === SERVER) out.push(from.start);
  }
  dynamic(ast.body, out, new WeakSet());
  return out;
}
