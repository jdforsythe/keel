import type { ObjectExpression, ObjectProperty } from "oxc-parser";
import type { EndpointParams } from "./EndpointParams.ts";
import { keyName } from "./keyName.ts";
import { propertyOf } from "./propertyOf.ts";

/**
 * `{ params: "absent" }` when the endpoint declares none, `{ params: "dynamic" }` when its fields cannot be read
 * statically (a spread, a computed key, another expression), else the fields.
 */
export function paramsFields(endpoint: ObjectExpression): "absent" | "dynamic" | EndpointParams {
  const p = propertyOf(endpoint, "params");
  if (p === null) return "absent";
  const v = p.value;
  if (v.type !== "CallExpression" || v.callee.type !== "MemberExpression" || v.callee.computed) return "dynamic";
  const { object, property } = v.callee;
  const arg = v.arguments[0];
  if (object.type !== "Identifier" || property.type !== "Identifier" || property.name !== "object") return "dynamic";
  if (arg?.type !== "ObjectExpression") return "dynamic";
  const props: ObjectProperty[] = [];
  for (const q of arg.properties) {
    if (q.type !== "Property" || keyName(q) === null) return "dynamic";
    props.push(q);
  }
  return { fields: arg, s: object.name, props };
}
