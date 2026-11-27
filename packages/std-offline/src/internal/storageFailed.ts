import { Failed } from "./Failed.schema.ts";

/**
 * The `expect` of an `attempt` whose callback is one `ctx.storage` call and nothing else (std.outbox Storage writes):
 * every value the driver rejects with, an `Error` or any other, is that call's failure, since a storage's callers handle
 * each rejection alike (k.persist, k.defects). A defect never reaches it (k.attempt). Its message says only whether the
 * value was an `Error`; nothing of the value is kept.
 */
export function storageFailed(x: unknown): ReturnType<typeof Failed.make> {
  return Failed.make(
    {},
    x instanceof Error ? "storage rejected with an Error" : "storage rejected with a non-Error value",
  );
}
