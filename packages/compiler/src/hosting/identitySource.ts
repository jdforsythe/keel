import { type Expression, type ObjectExpression, parseSync } from "oxc-parser";

const bare = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? bare(e.expression)
    : e;

function prop(o: ObjectExpression, key: string): Expression | undefined {
  for (const p of o.properties)
    if (p.type === "Property" && !p.computed && p.key.type === "Identifier" && p.key.name === key) return bare(p.value);
  return undefined;
}

/**
 * The project's `identity.server.ts` read statically (k.user Identity source): `problem`, the E1579 message when it
 * has no default export that is an `identity(...)` call or its `handle.path` literal is not of lowercase `/` segments;
 * `path`, that `handle.path` when it is a string literal; `mounted`, when it is `<x>.path` with `x` the default import
 * of `./identity.ts` (k.mount Declaration). Nothing is executed.
 */
export function identitySource(source: string): {
  readonly problem?: string;
  readonly path?: string;
  readonly mounted?: true;
} {
  const { program } = parseSync("identity.server.ts", source, { sourceType: "module", lang: "ts" });
  const def = program.body.find((s) => s.type === "ExportDefaultDeclaration")?.declaration;
  const call =
    def === undefined ||
    def.type === "FunctionDeclaration" ||
    def.type === "ClassDeclaration" ||
    def.type === "TSInterfaceDeclaration"
      ? undefined
      : bare(def);
  const named = call?.type === "CallExpression" && call.callee.type === "Identifier" && call.callee.name === "identity";
  const first = named ? call.arguments[0] : undefined;
  if (first === undefined || first.type === "SpreadElement")
    return { problem: "identity.server.ts needs `export default identity({ identify })`" };
  const opts = bare(first);
  const handle = opts.type === "ObjectExpression" ? prop(opts, "handle") : undefined;
  const at = handle?.type === "ObjectExpression" ? prop(handle, "path") : undefined;
  const mount = program.body.flatMap((s) =>
    s.type === "ImportDeclaration" && /^\.\/identity(\.ts)?$/.test(s.source.value)
      ? s.specifiers.flatMap((x) => (x.type === "ImportDefaultSpecifier" ? [x.local.name] : []))
      : [],
  );
  if (
    at?.type === "MemberExpression" &&
    !at.computed &&
    at.object.type === "Identifier" &&
    mount.includes(at.object.name) &&
    at.property.name === "path"
  )
    return { mounted: true };
  if (at?.type !== "Literal" || typeof at.value !== "string") return {};
  return /^(\/[a-z0-9-]+)+$/.test(at.value)
    ? { path: at.value }
    : { problem: `handle.path ${JSON.stringify(at.value).slice(0, 40)} is not lowercase / segments`, path: at.value };
}
