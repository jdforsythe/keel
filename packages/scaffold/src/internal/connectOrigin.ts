import MagicString from "magic-string";
import { appendProperty } from "./appendProperty.ts";
import { fitDeployable } from "./fitDeployable.ts";
import { propertyValue } from "./propertyValue.ts";
import { quote } from "./quote.ts";
import { topologyAst } from "./topologyAst.ts";

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
  if (origins !== null) return next;
  const props = [...deployable.properties.map((p) => src.slice(p.start, p.end)), `origins: { connect: { ${entry} } }`];
  return fitDeployable(src, next, deployable, d.prop.start, props);
}
