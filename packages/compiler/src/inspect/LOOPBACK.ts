/** Hostnames the inspect endpoint answers on without being listed (a non-loopback Host is DNS rebinding unless listed). */
export const LOOPBACK: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);
