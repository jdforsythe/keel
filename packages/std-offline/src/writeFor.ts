import type { KeelError, Result } from "@keel/schema";
import type { Write } from "./Write.schema.ts";

/**
 * The `{ key, base }` an action passes to `tx` when `write` was queued under `owner`, the owner its module gives the
 * request's caller (`""` for no one signed in); else `err`, which the server answers 400 with no store saved
 * (std.outbox-owner): `offline.signin` when the request has no user, `offline.owner` when it has another.
 */
export function writeFor(
  write: Write,
  owner: string,
): Result<
  { readonly key: string; readonly base: number },
  KeelError<"offline.owner" | "offline.signin", Readonly<Record<string, never>>>
> {
  if (write.owner === owner) return { ok: true, value: { key: write.key, base: write.base } };
  return owner === ""
    ? { ok: false, error: { code: "offline.signin", message: "signin", data: {} } }
    : { ok: false, error: { code: "offline.owner", message: "owner", data: {} } };
}
