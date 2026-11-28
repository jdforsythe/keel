import type { ObjectExpression, ObjectProperty, Program } from "oxc-parser";
import { keyOf } from "./keyOf.ts";
import { unwrap } from "./unwrap.ts";

/**
 * The entry object of a locale file, `export default <Set>.text({ ... })`, with each keyed property and the spans of
 * all of its properties in order; `undefined` when the file has no such default export.
 */
export function entryOf(
  program: Program,
  set: string,
):
  | {
      readonly obj: ObjectExpression;
      readonly props: readonly { readonly name: string; readonly index: number; readonly prop: ObjectProperty }[];
    }
  | undefined {
  for (const st of program.body) {
    if (st.type !== "ExportDefaultDeclaration") continue;
    const d = st.declaration;
    if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration" || d.type === "TSInterfaceDeclaration")
      return undefined;
    const call = unwrap(d);
    if (call.type !== "CallExpression" || call.callee.type !== "MemberExpression" || call.callee.computed)
      return undefined;
    const { object, property } = call.callee;
    if (object.type !== "Identifier" || object.name !== set || property.name !== "text") return undefined;
    const arg = call.arguments[0];
    const obj = arg === undefined || arg.type === "SpreadElement" ? undefined : unwrap(arg);
    if (obj?.type !== "ObjectExpression") return undefined;
    const props = obj.properties.flatMap((prop, index) => {
      const name = keyOf(prop);
      return name === undefined || prop.type !== "Property" ? [] : [{ name, index, prop }];
    });
    return { obj, props };
  }
  return undefined;
}
