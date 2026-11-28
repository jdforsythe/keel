import { enrol, madeRecord } from "@keel/schema/internal";

enrol("@keel/router", import.meta.url);

/**
 * What `@keel/router`'s makers made (k.identity): loaders, actions, guards, route tables and server-only stubs. A
 * binding of this module only; no entry exports it or a function that adds to it.
 */
export const records = Object.freeze({
  loader: madeRecord(),
  action: madeRecord(),
  guard: madeRecord(),
  routeTable: madeRecord(),
  serverOnly: madeRecord(),
});
