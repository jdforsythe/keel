/** `process.env[name]` as a string, or undefined where `process`, its `env` or a string value does not exist. */
export function envValue(name: string): string | undefined {
  const proc: unknown = Reflect.get(globalThis, "process");
  if (typeof proc !== "object" || proc === null) return undefined;
  const env: unknown = Reflect.get(proc, "env");
  if (typeof env !== "object" || env === null) return undefined;
  const v: unknown = Reflect.get(env, name);
  return typeof v === "string" ? v : undefined;
}
