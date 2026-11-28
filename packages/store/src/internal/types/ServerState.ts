import type { ServerRequest } from "./ServerRequest.ts";

/** Server state over one ctx (`serverState`): `request()` opens one request. */
export type ServerState = { request(): ServerRequest };
