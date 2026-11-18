import type { KeelError, Result } from "@keel/schema";
import type { Write } from "./Write.schema.ts";

/**
 * The `{ key, base }` an action passes to `tx` when `write` was queued under `owner`, the owner its module gives the
 * request's caller (`""` for no one signed in); else `err` `offline.owner`, which the server answers 400 with no store
 * saved (std.outbox-owner).
 */
export function writeFor(
  write: Write,
  owner: string,
): Result<
  { readonly key: string; readonly base: number },
  KeelError<"offline.owner", Readonly<Record<string, never>>>
> {
  return write.owner === owner
    ? { ok: true, value: { key: write.key, base: write.base } }
    : { ok: false, error: { code: "offline.owner", message: "owner", data: {} } };
}
