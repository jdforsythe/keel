import { isRecord } from "./isRecord.ts";

import { propsSchemaOf } from "../../unsafe/propsSchemaOf.ts";

/** Parse an island's serialized props with the component's `Props` schema when it has one. */
export function islandProps(
  component: unknown,
  json: unknown,
  id: string,
  warnings: string[],
): Record<string, unknown> {
  const props = propsSchemaOf(component);
  if (props === undefined) return isRecord(json) ? json : {};
  const r = props.parse(json ?? {});
  if (r.ok && isRecord(r.value)) return r.value;
  warnings.push(`E1253 [data-k-island="${id}"] props do not decode with its Props schema`);
  return isRecord(json) ? json : {};
}
