import type { Serve } from "./Serve.ts";

/** What `replayGroup` takes (std.multi): the user module's URL and the server, as `openGroup` took them. */
export interface ReplayGroupOptions {
  readonly user: string | URL;
  readonly serve: Serve;
}
