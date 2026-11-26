const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** A token set's unconditioned token for `prop` (a responsive value's `base`), or undefined. */
export function setToken(set: unknown, prop: string): string | undefined {
  const v = isRec(set) ? set[prop] : undefined;
  if (typeof v === "string") return v;
  const base = isRec(v) ? v.base : undefined;
  return typeof base === "string" ? base : undefined;
}
