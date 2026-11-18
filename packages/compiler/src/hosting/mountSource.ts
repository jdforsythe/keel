import { parseSync } from "oxc-parser";

/**
 * The project's `identity.ts` read statically (k.mount Declaration): `path`, the literal of its default export
 * `identityMount('<path>')`; `problem`, the E1580 message when the default export is not that call with a literal of
 * lowercase `/` segments. Nothing is executed.
 */
export function mountSource(source: string): { readonly problem?: string; readonly path?: string } {
  const { program } = parseSync("identity.ts", source, { sourceType: "module", lang: "ts" });
  const def = program.body.find((s) => s.type === "ExportDefaultDeclaration")?.declaration;
  const call = def?.type === "CallExpression" && def.callee.type === "Identifier" ? def : undefined;
  const arg =
    call?.callee.type === "Identifier" && call.callee.name === "identityMount" ? call.arguments[0] : undefined;
  if (arg?.type === "Literal" && typeof arg.value === "string" && /^(\/[a-z0-9-]+)+$/.test(arg.value))
    return { path: arg.value };
  return { problem: "identity.ts needs `export default identityMount('<path>')`, a literal of lowercase / segments" };
}
