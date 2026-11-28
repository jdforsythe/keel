import { scope } from "@keel/reactive";
import { outbox } from "@keel/std-offline";
import { shopping } from "./shopping.contract.ts";

/** The scope the outbox lives in: as long as the module, as the compiler gives a module-level store. */
const lifetime = scope(() => undefined);

/**
 * This browser's bought and back-on-the-list marks, in the order made (store `shopping.outbox`, kept in
 * `ctx.storage`): each waits here while the browser is offline and goes to `shopping.mark` once it is back, for the
 * member who made it. A mark the server refused stays until the member chooses.
 */
export const listOutbox = lifetime.run(() => outbox("shopping.outbox", shopping, { limit: 50 }));
