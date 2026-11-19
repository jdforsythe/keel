/** `enqueue` options (std.jobs): run no earlier than `delayMs` from now; `key` makes the enqueue idempotent. */
export type EnqueueOptions = { readonly delayMs?: number; readonly key?: string };
