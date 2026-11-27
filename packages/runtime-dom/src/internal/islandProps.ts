import { isSchema } from "@keel/schema";
import { isRecord } from "./isRecord.ts";

/** Parse an island's serialized props with the component's `Props` schema when it has one (an `s` schema, k.identity). */
export function islandProps(
  component: unknown,
  json: unknown,
  id: string,
  warnings: string[],
): Record<string, unknown> {
  const props = typeof component === "function" ? Object.getOwnPropertyDescriptor(component, "Props")?.value : undefined;
  if (!isSchema(props)) return isRecord(json) ? json : {};
  const r = props.parse(json ?? {});
  if (r.ok && isRecord(r.value)) return r.value;
  warnings.push(`E1253 [data-k-island="${id}"] props do not decode with its Props schema`);
  return isRecord(json) ? json : {};
}
