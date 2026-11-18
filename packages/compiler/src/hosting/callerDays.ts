import { type Expression, type ObjectExpression, parseSync } from "oxc-parser";

const bare = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? bare(e.expression)
    : e;

/** The value of the non-computed property `key` of object literal `o`, unwrapped. */
function prop(o: ObjectExpression, key: string): Expression | undefined {
  for (const p of o.properties) {
    if (p.type !== "Property" || p.computed) continue;
    const k = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? p.key.value : undefined;
    if (k === key) return bare(p.value);
  }
  return undefined;
}

/**
 * Each deployable of `topology.ts` that sets `caller` (k.user Caller lifetime), read statically: `[deployable, adapter,
 * days]`, `adapter` its literal (`""` when not one) and `days` the literal number of `caller: { days }`, `NaN` when
 * `caller` is not that shape. Nothing is executed; a file the static read cannot take gives none.
 */
export function callerDays(source: string): [string, string, number][] {
  const { program } = parseSync("topology.ts", source, { sourceType: "module", lang: "ts" });
  const def = program.body.find((s) => s.type === "ExportDefaultDeclaration")?.declaration;
  const top =
    def === undefined ||
    def.type === "FunctionDeclaration" ||
    def.type === "ClassDeclaration" ||
    def.type === "TSInterfaceDeclaration"
      ? undefined
      : bare(def);
  const arg = top?.type === "CallExpression" ? top.arguments[0] : top;
  const all = arg === undefined || arg.type === "SpreadElement" ? undefined : bare(arg);
  const out: [string, string, number][] = [];
  for (const p of all?.type === "ObjectExpression" ? all.properties : []) {
    const key = p.type === "Property" ? p.key : undefined;
    const name =
      key?.type === "Identifier"
        ? key.name
        : key?.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined;
    const d = p.type === "Property" ? bare(p.value) : undefined;
    const caller = d?.type === "ObjectExpression" ? prop(d, "caller") : undefined;
    if (name === undefined || d?.type !== "ObjectExpression" || caller === undefined) continue;
    const adapter = prop(d, "adapter");
    const days = caller.type === "ObjectExpression" ? prop(caller, "days") : undefined;
    out.push([
      name,
      adapter?.type === "Literal" && typeof adapter.value === "string" ? adapter.value : "",
      days?.type === "Literal" && typeof days.value === "number" ? days.value : Number.NaN,
    ]);
  }
  return out;
}
