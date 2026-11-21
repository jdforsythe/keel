// re-exports only. The client half of std.offline: declare an outbox, send through it, drain it, resolve refusals.
export type { Outbox } from "./Outbox.type.ts";
export { OutboxEntry } from "./OutboxEntry.schema.ts";
export type { OutboxResult } from "./OutboxResult.ts";
export { Resolution } from "./Resolution.schema.ts";
export type { SendInput } from "./SendInput.ts";
export { Write } from "./Write.schema.ts";
export { drain } from "./drain.ts";
export { outbox } from "./outbox.ts";
export { resolve } from "./resolve.ts";
export { send } from "./send.ts";
export { writeFor } from "./writeFor.ts";
