import type { Mode } from "../Mode.ts";

/** sim when process.env.KEEL_TEST === "1" (keel test), else real. Safe where `process` does not exist. */
export function defaultMode(): Mode {
  const proc: unknown = Reflect.get(globalThis, "process");
  if (typeof proc !== "object" || proc === null) return "real";
  const env: unknown = Reflect.get(proc, "env");
  if (typeof env !== "object" || env === null) return "real";
  return Reflect.get(env, "KEEL_TEST") === "1" ? "sim" : "real";
}
