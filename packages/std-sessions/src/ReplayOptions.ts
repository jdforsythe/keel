import type { SimCtx } from "@keel/ctx";
import type { RouteTable } from "@keel/router";
import type { DocumentApp } from "@keel/testing";

/**
 * What `replay` and `minimize` take (std.sessions API): the route table, the `redact` entries the recording ctx had,
 * `serve` (a function of the replay ctx resolving a `createApp` result made on it: the base is then a page a `node`
 * deployable serves) and `user` (the id the base renders signed in as).
 */
export interface ReplayOptions {
  readonly routes: RouteTable;
  readonly redact?: readonly string[];
  readonly serve?: (ctx: SimCtx) => Promise<DocumentApp> | DocumentApp;
  readonly user?: string;
}
