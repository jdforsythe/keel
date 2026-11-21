import { scope } from "@keel/reactive";
import { outbox } from "@keel/std-offline";
import { api } from "../api/api.contract.ts";

/** The scope the outbox lives in: as long as the module, as the compiler gives a module-level store. */
const lifetime = scope(() => undefined);

/**
 * This client's board writes, in the order sent (store `todos.outbox`, kept in `ctx.storage`), sent to the `api`
 * module's write routes through its service: each waits here while the client is offline, and a write the board refused
 * stays until the user keeps theirs or the other one. golden-1 has no sign-in, so every write's owner is `""`.
 */
export const boardOutbox = lifetime.run(() => outbox("todos.outbox", api));
