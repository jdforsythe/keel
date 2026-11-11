import type { ObjectExpression } from "oxc-parser";
import type { DeployableNode } from "./DeployableNode.ts";
import { callArgObject } from "./callArgObject.ts";
import { keyName } from "./keyName.ts";
import { parseSource } from "./parseSource.ts";
import { propertyValue } from "./propertyValue.ts";
import { stringItems } from "./stringItems.ts";

const ADAPTERS = ["node", "static", "client"] as const;
const adapterOf = (v: unknown): DeployableNode["adapter"] | null => ADAPTERS.find((a) => a === v) ?? null;

/**
 * The `topology({...})` object of `topology.ts` and its deployables with a literal name, a `modules` array literal
 * and a literal adapter, in source order; null when the file does not parse or has no `topology({...})` call.
 */
export function topologyAst(src: string): { obj: ObjectExpression; deployables: DeployableNode[] } | null {
  const program = parseSource("topology.ts", src);
  const obj = program === null ? null : callArgObject(program, "topology");
  if (obj === null) return null;
  const deployables: DeployableNode[] = [];
  for (const prop of obj.properties) {
    const name = keyName(prop);
    if (name === null || prop.type !== "Property" || prop.value.type !== "ObjectExpression") continue;
    const list = propertyValue(prop.value, "modules");
    const a = propertyValue(prop.value, "adapter");
    const adapter = a?.type === "Literal" ? adapterOf(a.value) : null;
    if (list?.type !== "ArrayExpression" || adapter === null) continue;
    deployables.push({ name, adapter, modules: stringItems(list), prop, list });
  }
  return { obj, deployables };
}
