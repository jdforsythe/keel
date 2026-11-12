import net from "node:net";

/** The host Vite's dev server binds when the config names none. */
const DEV_HOST = "localhost";

const bindable = (port: number, host: string | undefined): Promise<boolean> =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(host === undefined ? { port } : { port, host }, () => probe.close(() => resolve(true)));
  });

/**
 * True when `port` cannot be bound right now (in use, or refused), on the host Vite binds or on every address: a
 * listener opened without a host holds the port on all of them, and some systems let a single address bind beside it.
 * The probes close before this resolves.
 */
export async function portBusy(port: number, host: string = DEV_HOST): Promise<boolean> {
  return !((await bindable(port, host)) && (await bindable(port, undefined)));
}
