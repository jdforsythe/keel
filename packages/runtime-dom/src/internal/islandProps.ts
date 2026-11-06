import { isRecord } from "./isRecord.ts";

type WithProps = { Props: { decode(json: unknown): { ok: true; value: unknown } | { ok: false } } };

const hasPropsSchema = (c: unknown): c is WithProps =>
  typeof c === "function" &&
  "Props" in c &&
  typeof c.Props === "object" &&
  c.Props !== null &&
  "decode" in c.Props &&
  typeof c.Props.decode === "function";

/** Decode an island's serialized props with the component's `Props` schema codec when it has one. */
export function islandProps(
  component: unknown,
  json: unknown,
  id: string,
  warnings: string[],
): Record<string, unknown> {
  if (!hasPropsSchema(component)) return isRecord(json) ? json : {};
  const r = component.Props.decode(json ?? {});
  if (r.ok && isRecord(r.value)) return r.value;
  warnings.push(`E1253 [data-k-island="${id}"] props do not decode with its Props schema`);
  return isRecord(json) ? json : {};
}
