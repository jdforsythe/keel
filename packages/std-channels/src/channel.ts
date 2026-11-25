import { type ObjectSchema, type Schema, s, secretPath } from "@keel/schema";
import { fault } from "../unsafe/fault.ts";
import type { Channel } from "./Channel.type.ts";
import { eventsOf } from "./internal/eventsOf.ts";

type Opts<P> = { readonly path: string; readonly params: ObjectSchema<P> };

/** A channel without `message`: nothing can be published, and `body` is undefined. */
export function channel<P>(name: string, opts: Opts<P> & { readonly message?: undefined }): Channel<P, never>;
/** A channel with `message`: `body` is the publish entry's `{ message }`. */
export function channel<P, M>(name: string, opts: Opts<P> & { readonly message: Schema<M> }): Channel<P, M>;
/**
 * Declare a channel (std.channels Declare) in a `*.schema.ts` file whose name is the export. Its `events` (the
 * `ChannelEvent` schema of its `message`) and `body` (`s.object({ message })`, undefined without `message`) are made
 * once here, so the contract entries that name them hold the very schemas `channelRoute` checks for. Throws E2602 (an
 * Error with `code`) when `message` holds an `s.secret`: a message reaches every member's browser as published.
 */
export function channel<P, M>(name: string, opts: Opts<P> & { readonly message?: Schema<M> | undefined }): object {
  const { message } = opts;
  const at = message === undefined ? null : secretPath(message);
  if (at !== null) {
    return fault(
      "E2602",
      `E2602 channel ${name} message holds s.secret at ${at || "(root)"}; members receive it as sent`,
    );
  }
  const body = message === undefined ? undefined : s.object({ message });
  return Object.freeze({ name, ...opts, events: eventsOf(message), body });
}
