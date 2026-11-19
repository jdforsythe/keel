import net from "node:net";

/** Every address a dev server could hold the port on: one probe per family and per specific/unspecified host. */
const ADDRESSES = ["127.0.0.1", "0.0.0.0", "::1", "::"] as const;

/** Errors that mean this machine lacks the address family, not that the port is taken. */
const ABSENT = new Set(["EADDRNOTAVAIL", "EAFNOSUPPORT"]);

const probe = (port: number, host: string): Promise<string | undefined> =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (e: NodeJS.ErrnoException) => {
      server.close(() => resolve(e.code === undefined || ABSENT.has(e.code) ? undefined : e.code));
    });
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(undefined)));
  });

/**
 * The error code of the first address on which `port` cannot be bound (EADDRINUSE, EACCES, ...), or undefined when it
 * binds on all of `127.0.0.1`, `0.0.0.0`, `::1` and `::`. An address family the machine lacks counts as free. Each
 * probe closes its listener before the next starts.
 */
export async function portProbe(port: number): Promise<string | undefined> {
  for (const host of ADDRESSES) {
    const code = await probe(port, host);
    if (code !== undefined) return code;
  }
  return undefined;
}
