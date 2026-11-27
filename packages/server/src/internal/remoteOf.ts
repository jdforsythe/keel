const field = (v: unknown, key: string): unknown =>
  typeof v === "object" && v !== null ? Reflect.get(v, key) : undefined;

/**
 * The remote address of the connection `env` holds (`Connection`: `env.incoming.socket.remoteAddress`), or undefined
 * when there is no connection. No header is read: a forwarding header names what a client wrote.
 */
export function remoteOf(env: unknown): string | undefined {
  const peer = field(field(field(env, "incoming"), "socket"), "remoteAddress");
  return typeof peer === "string" && peer !== "" ? peer : undefined;
}
