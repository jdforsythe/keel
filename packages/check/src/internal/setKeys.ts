const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/**
 * The breakpoint keys of a style prop in a token style set (a `base` set or a look): `undefined` when absent,
 * `["base"]` for a token name, the keys holding a value for a responsive record, `null` for anything else.
 */
export function setKeys(v: unknown): readonly string[] | null | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string") return ["base"];
  if (!isRec(v)) return null;
  return Object.keys(v).filter((k) => v[k] !== undefined);
}
