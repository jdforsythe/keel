/** Seed when neither the caller nor `KEEL_SEED` gives one. */
const DEFAULT_SEED = 1337;

/** The run seed: `explicit` if given, else the integer in `KEEL_SEED`, else 1337. */
export function seedFrom(explicit: number | undefined): number {
  if (explicit !== undefined) return explicit;
  const proc: unknown = Reflect.get(globalThis, "process");
  const env: unknown = typeof proc === "object" && proc !== null ? Reflect.get(proc, "env") : undefined;
  const raw: unknown = typeof env === "object" && env !== null ? Reflect.get(env, "KEEL_SEED") : undefined;
  if (typeof raw !== "string" || !/^-?\d+$/.test(raw.trim())) return DEFAULT_SEED;
  return Number.parseInt(raw, 10);
}
