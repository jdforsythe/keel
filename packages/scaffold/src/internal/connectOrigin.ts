import MagicString from "magic-string";
import type { ObjectExpression } from "oxc-parser";
import { appendProperty } from "./appendProperty.ts";
import { lineIndent } from "./lineIndent.ts";
import { propertyValue } from "./propertyValue.ts";
import { quote } from "./quote.ts";
import { topologyAst } from "./topologyAst.ts";

/** The longest line the edit leaves on one line; past it the deployable is written one property per line. */
const WIDTH = 120;

/** `obj` of `src` with `text` as its last property, one property per line at `indent`. */
function spread(src: string, obj: ObjectExpression, text: string, indent: string): string {
  const props = [...obj.properties.map((p) => src.slice(p.start, p.end)), text];
  return `{\n${props.map((p) => `${indent}  ${p},\n`).join("")}${indent}}`;
}

/**
 * `topology.ts` with `origin: reason` declared under `origins.connect` of deployable `name` (k.origins Declaration),
 * in the file's quote style: the entry joins the `connect` object, or `connect` joins `origins`, or `origins` joins the
 * deployable, each as the last property in the object's layout. A one-line deployable the entry would take past 120
 * columns is written one property per line. Null when the file has no such deployable, or one of the three is
 * written as something other than an object literal.
 */
export function connectOrigin(src: string, name: string, origin: string, reason: string): string | null {
  const d = topologyAst(src)?.deployables.find((x) => x.name === name);
  if (d === undefined || d.prop.type !== "Property" || d.prop.value.type !== "ObjectExpression") return null;
  const str = (text: string): string => (src.charAt(d.list.start + 1) === "'" ? quote(text) : JSON.stringify(text));
  const entry = `${str(origin)}: ${str(reason)}`;
  const deployable = d.prop.value;
  const origins = propertyValue(deployable, "origins");
  const connect = origins?.type === "ObjectExpression" ? propertyValue(origins, "connect") : null;
  if (origins !== null && origins.type !== "ObjectExpression") return null;
  if (connect !== null && connect.type !== "ObjectExpression") return null;
  const ms = new MagicString(src);
  if (connect !== null) appendProperty(ms, src, connect, entry);
  else if (origins !== null) appendProperty(ms, src, origins, `connect: { ${entry} }`);
  else appendProperty(ms, src, deployable, `origins: { connect: { ${entry} } }`);
  const next = ms.toString();
  const first = deployable.properties[0];
  const inline = first !== undefined && !src.slice(deployable.start, first.start).includes("\n");
  const line = next.slice(next.lastIndexOf("\n", d.prop.start) + 1).split("\n")[0] ?? "";
  if (origins !== null || !inline || line.length <= WIDTH) return next;
  const wide = spread(src, deployable, `origins: { connect: { ${entry} } }`, lineIndent(src, d.prop.start));
  return `${src.slice(0, deployable.start)}${wide}${src.slice(deployable.end)}`;
}
