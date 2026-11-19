import type { Opts } from "./Opts.ts";

/** The properties of an object literal with a static key, as `{ name, at, value }`; none when `e` is not one. */
export function entries(e: Opts): { readonly name: string; readonly at: number; readonly value: Opts }[] {
  const out: { name: string; at: number; value: Opts }[] = [];
  if (e?.type !== "ObjectExpression") return out;
  for (const p of e.properties) {
    if (p.type !== "Property" || p.computed) continue;
    const k = p.key;
    const name = k.type === "Identifier" ? k.name : k.type === "Literal" ? k.value : undefined;
    if (typeof name === "string") out.push({ name, at: k.start, value: p.value });
  }
  return out;
}
