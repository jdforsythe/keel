import type { ObjectSchema, Schema } from "@keel/schema";
import { secretPathOf } from "@keel/schema/internal";
import type { Channel } from "./Channel.type.ts";

/**
 * Declare a channel (std.channels Declare) in a shared file whose name is the export. Throws E2602 (an Error with
 * `code`) when `message` holds an `s.secret`: a message reaches every member's browser as published.
 */
export function channel<P, M = never>(
  name: string,
  opts: { readonly path: string; readonly params: ObjectSchema<P>; readonly message?: Schema<M> },
): Channel<P, M> {
  const at = opts.message === undefined ? null : secretPathOf(opts.message.node);
  if (at !== null) {
    const message = `E2602 channel ${name} message holds s.secret at ${at || "(root)"}; members receive it as sent`;
    throw Object.assign(new Error(message), { code: "E2602" });
  }
  return Object.freeze({ name, ...opts });
}
