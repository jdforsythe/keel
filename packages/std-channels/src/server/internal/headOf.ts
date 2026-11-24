/** The `head` of a stored store snapshot (k.server Server state), or `undefined` when `raw` is no snapshot with a whole-number head. */
export function headOf(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  try {
    const json: unknown = JSON.parse(raw);
    const head: unknown = typeof json === "object" && json !== null ? Reflect.get(json, "head") : undefined;
    return typeof head === "number" && Number.isInteger(head) ? head : undefined;
  } catch {
    return undefined;
  }
}
