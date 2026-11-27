import type { Connection } from "./Connection.ts";

/**
 * A built deployable from `createApp`: a fetch handler (Hono underneath; `connection` the request's own, which a
 * `local: true` route needs: k.contract Local routes) and `close()`, which aborts every runner's
 * `signal` and open event stream and resolves when every `run` has settled (k.topology Runners).
 */
export type ServerApp = {
  fetch(req: Request, connection?: Connection): Promise<Response>;
  close(): Promise<void>;
};
