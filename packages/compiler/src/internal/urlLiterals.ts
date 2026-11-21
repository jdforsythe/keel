import { type Program, Visitor } from "oxc-parser";

/**
 * The files `program` names by `new URL(<literal>, import.meta.url)` (k.bundle Bundles): a worker's
 * `new Worker(new URL(…))`, an asset's URL. Each is the literal and the `new` expression's start.
 */
export function urlLiterals(program: Program): { source: string; start: number }[] {
  const out: { source: string; start: number }[] = [];
  new Visitor({
    NewExpression: (n) => {
      if (n.callee.type !== "Identifier" || n.callee.name !== "URL") return;
      const [first, second] = n.arguments;
      const meta =
        second?.type === "MemberExpression" &&
        !second.computed &&
        second.object.type === "MetaProperty" &&
        second.object.meta.name === "import" &&
        second.property.type === "Identifier" &&
        second.property.name === "url";
      const text =
        first?.type === "Literal"
          ? first.value
          : first?.type === "TemplateLiteral" && first.expressions.length === 0
            ? first.quasis[0]?.value.cooked
            : null;
      if (meta && typeof text === "string") out.push({ source: text, start: n.start });
    },
  }).visit(program);
  return out;
}
