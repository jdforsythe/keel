/** Vite's default dev port, used when its resolved config carries none. */
const VITE_DEFAULT_PORT = 5173;

/**
 * The port `keel dev` probes and serves on: `--port` when given, else the port Vite resolved from the project's
 * config (`server.port`), else Vite's default 5173. A resolved value that is not a port in 1..65535 counts as none.
 */
export function devPort(flag: number | undefined, resolved: unknown): number {
  if (flag !== undefined) return flag;
  return typeof resolved === "number" && Number.isInteger(resolved) && resolved >= 1 && resolved <= 65535
    ? resolved
    : VITE_DEFAULT_PORT;
}
