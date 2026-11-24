import MagicString from "magic-string";
import { appendProperty } from "./appendProperty.ts";
import { fitDeployable } from "./fitDeployable.ts";
import { keyName } from "./keyName.ts";
import { propertyValue } from "./propertyValue.ts";
import { quote } from "./quote.ts";
import { topologyAst } from "./topologyAst.ts";

/**
 * `topology.ts` with `<shell>: { id, name }` declared under `shells` of deployable `deployable` (k.scaffold-shell
 * Edits), in the file's quote style: the entry joins the `shells` object, or `shells` joins the deployable, each as
 * the last property in the object's layout. A one-line deployable the edit would take past 120 columns is written
 * one property per line. Null when the file has no such deployable, or it or its `shells` is written as something
 * other than an object literal.
 */
export function declareShell(
  src: string,
  deployable: string,
  shell: string,
  shellId: string,
  title: string,
): string | null {
  const d = topologyAst(src)?.deployables.find((x) => x.name === deployable);
  if (d === undefined || d.prop.type !== "Property" || d.prop.value.type !== "ObjectExpression") return null;
  const str = (text: string): string => (src.charAt(d.list.start + 1) === "'" ? quote(text) : JSON.stringify(text));
  const entry = `${shell}: { id: ${str(shellId)}, name: ${str(title)} }`;
  const obj = d.prop.value;
  const shells = propertyValue(obj, "shells");
  if (shells !== null && shells.type !== "ObjectExpression") return null;
  const ms = new MagicString(src);
  if (shells === null) appendProperty(ms, src, obj, `shells: { ${entry} }`);
  else appendProperty(ms, src, shells, entry);
  const props = obj.properties.map((p) =>
    shells !== null && p.type === "Property" && keyName(p) === "shells"
      ? `${src.slice(p.start, shells.start)}${ms.slice(shells.start, shells.end)}`
      : src.slice(p.start, p.end),
  );
  return fitDeployable(
    src,
    ms.toString(),
    obj,
    d.prop.start,
    shells === null ? [...props, `shells: { ${entry} }`] : props,
  );
}
