/**
 * A built deployable from `createApp`: a fetch handler (Hono underneath) and `close()`, which aborts every runner's
 * `signal` and open event stream and resolves when every `run` has settled (k.topology Runners).
 */
export type ServerApp = {
  fetch(req: Request): Promise<Response>;
  close(): Promise<void>;
};
