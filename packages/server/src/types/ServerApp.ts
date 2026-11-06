/** A built deployable from `createApp`: a fetch handler (Hono underneath). */
export type ServerApp = {
  fetch(req: Request): Promise<Response>;
};
