// A group's project host (std.multi): a worker thread holding one SSR dev server through the Vite config `config`
// names (or none, Vite's own TypeScript transform, rooted at `root`), answering each `{ id, data }` module request a
// user worker's runner sends (`vite:invoke`) with `{ id, result }` or `{ id, error }`. Vite runs only here and in the
// user workers, never in the group's own thread.
import { parentPort, workerData } from "node:worker_threads";
import { createServer } from "vite";
import { field } from "./field.ts";

const root = field(workerData, "root");
const config = field(workerData, "config");
if (typeof root !== "string" || (config !== undefined && typeof config !== "string"))
  throw new TypeError("group: bad project host data");
const port = parentPort;
if (port === null) throw new TypeError("group: no parent port");

const server = await createServer({
  root,
  configFile: config ?? false,
  logLevel: "silent",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const ssr = server.environments.ssr;

/** An error as its `name`, `message` and `stack`, which cross a thread. */
function plain(e: unknown): { name: string; message: string; stack: string | undefined } {
  const text = (k: string): string | undefined => {
    const v: unknown = typeof e === "object" && e !== null ? Reflect.get(e, k) : undefined;
    return typeof v === "string" ? v : undefined;
  };
  return { name: text("name") ?? "Error", message: text("message") ?? String(e), stack: text("stack") };
}

port.on("message", (m: unknown) => {
  const id = field(m, "id");
  ssr.hot.handleInvoke({ type: "custom", event: "vite:invoke", data: field(m, "data") }).then(
    (r) => port.postMessage("error" in r ? { id, error: plain(r.error) } : { id, result: r.result }),
    (e: unknown) => port.postMessage({ id, error: plain(e) }),
  );
});
port.postMessage({ ready: true });
