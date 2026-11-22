let installed = false;

/**
 * On Node, makes the type of service best effort on each socket the platform fetch connects. Node's fetch sets it on
 * every request it writes (`socket.setTypeOfService`), and on macOS that throws EINVAL once the peer has reset the
 * connection, from a socket event where no caller can catch it: the process ends. Here an EINVAL leaves the type of
 * service unset, and the request fails as a reset does, a rejected fetch. The platform fetch's agent is the process's
 * one; its `undici:client:connected` channel hands over each new socket before the first write, and only that socket's
 * `setTypeOfService` changes. Elsewhere (a browser, a runtime without the channel) nothing happens.
 */
export function typeOfServiceBestEffort(): void {
  if (installed) return;
  installed = true;
  const channels = builtin("node:diagnostics_channel");
  if (typeof channels !== "object" || channels === null || !("subscribe" in channels)) return;
  const subscribe = channels.subscribe;
  if (typeof subscribe !== "function") return;
  Reflect.apply(subscribe, channels, ["undici:client:connected", (message: unknown) => settle(message)]);
}

/** The Node built-in module `id`, read without Node's types (ctx compiles for browsers too); else undefined. */
function builtin(id: string): unknown {
  const host: unknown = Reflect.get(globalThis, "process");
  if (typeof host !== "object" || host === null || !("getBuiltinModule" in host)) return undefined;
  const get = host.getBuiltinModule;
  return typeof get === "function" ? Reflect.apply(get, host, [id]) : undefined;
}

/** Gives the socket a `message` carries a `setTypeOfService` that leaves the type of service unset on EINVAL. */
function settle(message: unknown): void {
  if (typeof message !== "object" || message === null || !("socket" in message)) return;
  const socket = message.socket;
  if (typeof socket !== "object" || socket === null || !("setTypeOfService" in socket)) return;
  const set = socket.setTypeOfService;
  if (typeof set !== "function") return;
  Object.defineProperty(socket, "setTypeOfService", {
    configurable: true,
    writable: true,
    value(tos: number): unknown {
      try {
        return Reflect.apply(set, socket, [tos]);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "EINVAL") return socket;
        throw error;
      }
    },
  });
}
