import { parseSync } from "oxc-parser";

/** A `links` entry `identityMount` takes: `/`-led segments of `[A-Za-z0-9._~-]`, none `.` or `..`, not `''`. */
const LINK = /^(\/(?!\.\.?(\/|$))[\w.~-]+)+$/;
const E1580 = "identity.ts's default export is not identityMount('<literal>') of lowercase / segments";

/**
 * The project's `identity.ts` read statically (k.mount Declaration): `path`, the literal of its default export
 * `identityMount('<path>', { links: [...] }?)`; `problem`, the E1580 message when the default export is not that call
 * with a literal of lowercase `/` segments and, optionally, an object literal holding only a `links` array literal;
 * `links`, one E1584 problem per entry that is not a string literal, is `''`, is not of `href`'s subpath form, or
 * repeats an earlier one, at the entry's offset (left out when there is none). Nothing is executed.
 */
export function mountSource(source: string): {
  readonly problem?: string;
  readonly path?: string;
  readonly links?: readonly { readonly offset: number; readonly message: string }[];
} {
  const { program } = parseSync("identity.ts", source, { sourceType: "module", lang: "ts" });
  const def = program.body.find((s) => s.type === "ExportDefaultDeclaration")?.declaration;
  const call = def?.type === "CallExpression" && def.callee.type === "Identifier" ? def : undefined;
  const args = call?.callee.type === "Identifier" && call.callee.name === "identityMount" ? call.arguments : [];
  const [arg, options, ...rest] = args;
  if (
    arg?.type !== "Literal" ||
    typeof arg.value !== "string" ||
    !/^(\/[a-z0-9-]+)+$/.test(arg.value) ||
    rest.length > 0
  )
    return { problem: E1580 };
  if (options === undefined) return { path: arg.value };
  const props = options.type === "ObjectExpression" ? options.properties : null;
  const prop = props?.[0];
  if (props === null || props.length > 1) return { problem: E1580 };
  if (prop === undefined) return { path: arg.value };
  if (
    prop.type !== "Property" ||
    prop.computed ||
    prop.shorthand ||
    prop.kind !== "init" ||
    prop.key.type !== "Identifier" ||
    prop.key.name !== "links" ||
    prop.value.type !== "ArrayExpression"
  )
    return { problem: E1580 };
  const seen = new Set<string>();
  const links: { offset: number; message: string }[] = [];
  for (const entry of prop.value.elements) {
    const offset = entry?.start ?? prop.value.start;
    if (entry?.type !== "Literal" || typeof entry.value !== "string")
      links.push({ offset, message: "links entry not a string literal" });
    else if (!LINK.test(entry.value))
      links.push({
        offset,
        message: `links entry ${JSON.stringify(entry.value).slice(0, 30)}: not / segments of [A-Za-z0-9._~-]`,
      });
    else if (seen.has(entry.value))
      links.push({ offset, message: `links entry ${JSON.stringify(entry.value).slice(0, 30)} repeated` });
    else seen.add(entry.value);
  }
  return links.length > 0 ? { path: arg.value, links } : { path: arg.value };
}
