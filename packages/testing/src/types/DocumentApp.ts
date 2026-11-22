/** What `renderRoute` with `app` requests documents from: a `createApp` result (k.server), read structurally. */
export interface DocumentApp {
  fetch(req: Request): Promise<Response>;
}
