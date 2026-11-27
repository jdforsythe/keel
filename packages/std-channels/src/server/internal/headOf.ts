import { s } from "@keel/schema";
/** The `head` of a stored store snapshot (k.server Server state), or `undefined` when `raw` is no snapshot with a whole-number head. */
export function headOf(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = s.json.parseJson(raw);
  if (!parsed.ok) return undefined;
  const json = parsed.value;
  const head: unknown = typeof json === "object" && json !== null ? Reflect.get(json, "head") : undefined;
  return typeof head === "number" && Number.isInteger(head) ? head : undefined;
}
