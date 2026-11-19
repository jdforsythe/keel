import type { ObjectExpression } from "oxc-parser";
import type { DeployableNode } from "./DeployableNode.ts";
import { callArgObject } from "./callArgObject.ts";
import { keyName } from "./keyName.ts";
import { parseSource } from "./parseSource.ts";
import { propertyValue } from "./propertyValue.ts";
import { stringItems } from "./stringItems.ts";

const ADAPTERS = ["node", "static", "client"] as const;
const adapterOf = (v: unknown): DeployableNode["adapter"] | null => ADAPTERS.find((a) => a === v) ?? null;
const STORAGES = ["file", "sqlite", "postgres"] as const;

const text = (obj: ObjectExpression, name: string): string | undefined => {
  const v = propertyValue(obj, name);
  return v?.type === "Literal" && typeof v.value === "string" ? v.value : undefined;
};
/** `{ id, name }` with literal strings, else undefined. */
const shellOf = (obj: ObjectExpression, name: string): { id: string; name: string } | undefined => {
  const v = propertyValue(obj, name);
  if (v?.type !== "ObjectExpression") return undefined;
  const id = text(v, "id");
  const title = text(v, "name");
  return id === undefined || title === undefined ? undefined : { id, name: title };
};
const shellsOf = (obj: ObjectExpression): DeployableNode["shells"] => {
  const v = propertyValue(obj, "shells");
  if (v?.type !== "ObjectExpression") return undefined;
  const capacitor = shellOf(v, "capacitor");
  const tauri = shellOf(v, "tauri");
  if (capacitor === undefined && tauri === undefined) return undefined;
  return { ...(capacitor === undefined ? {} : { capacitor }), ...(tauri === undefined ? {} : { tauri }) };
};

/**
 * The `topology({...})` object of `topology.ts` and its deployables with a literal name, a `modules` array literal
 * and a literal adapter, in source order (`storage` and `shells` kept when literal); null when the file does not parse or has no `topology({...})` call.
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
    const h = propertyValue(prop.value, "host");
    const host = h?.type === "Literal" && typeof h.value === "string" ? h.value : undefined;
    const st = text(prop.value, "storage");
    const storage = STORAGES.find((x) => x === st);
    const shells = shellsOf(prop.value);
    deployables.push({ name, adapter, modules: stringItems(list), host, storage, shells, prop, list });
  }
  return { obj, deployables };
}
