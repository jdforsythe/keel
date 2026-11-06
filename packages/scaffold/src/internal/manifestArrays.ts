import type { ArrayExpression, Program } from "oxc-parser";
import { callArgObject } from "./callArgObject.ts";
import { propertyValue } from "./propertyValue.ts";

/** The `id` value, `deps` array and `public.exports` array literals of a parsed `module({...})` manifest. */
export function manifestArrays(program: Program): {
  id: string | null;
  deps: ArrayExpression | null;
  exports: ArrayExpression | null;
} | null {
  const obj = callArgObject(program, "module");
  if (obj === null) return null;
  const id = propertyValue(obj, "id");
  const deps = propertyValue(obj, "deps");
  const pub = propertyValue(obj, "public");
  const exp = pub?.type === "ObjectExpression" ? propertyValue(pub, "exports") : null;
  return {
    id: id?.type === "Literal" && typeof id.value === "string" ? id.value : null,
    deps: deps?.type === "ArrayExpression" ? deps : null,
    exports: exp?.type === "ArrayExpression" ? exp : null,
  };
}
