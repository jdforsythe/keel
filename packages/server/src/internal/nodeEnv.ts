/**
 * `process.env.NODE_ENV` trimmed and lowercased, or undefined where `process`, its `env`, or a string value does not
 * exist. `createApp` treats anything but `development` and `test` (unset included) as a deployed production (RFC 0052).
 */
export function nodeEnv(): string | undefined {
  const proc: unknown = Reflect.get(globalThis, "process");
  if (typeof proc !== "object" || proc === null) return undefined;
  const env: unknown = Reflect.get(proc, "env");
  if (typeof env !== "object" || env === null) return undefined;
  const v: unknown = Reflect.get(env, "NODE_ENV");
  return typeof v === "string" ? v.trim().toLowerCase() : undefined;
}
