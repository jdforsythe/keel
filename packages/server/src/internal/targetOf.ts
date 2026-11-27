const field = (v: unknown, key: string): unknown =>
  typeof v === "object" && v !== null ? Reflect.get(v, key) : undefined;

/**
 * The request target as the connection `env` holds received it (`Connection`: `env.incoming.url`), `/tools` in origin
 * form or `http://host/tools` in absolute form; undefined when there is no connection.
 */
export function targetOf(env: unknown): string | undefined {
  const url = field(field(env, "incoming"), "url");
  return typeof url === "string" && url !== "" ? url : undefined;
}
