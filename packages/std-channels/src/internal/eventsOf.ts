import { type Schema, s } from "@keel/schema";
import type { ChannelEvent } from "../ChannelEvent.ts";

type Of<M> = Schema<ChannelEvent<M>>;

/** The schema of a channel's stream events: the `message` variant only when the channel declares `message`. */
export function eventsOf<M>(message: Schema<M> | undefined): Of<M> {
  const reset: Of<M> = s.object({ kind: s.literal("reset") });
  const saved: Of<M> = s.object({ kind: s.literal("saved"), store: s.string(), head: s.int({ min: 0 }) });
  const changed: Of<M> = s.object({ kind: s.literal("changed") });
  const closed: Of<M> = s.object({ kind: s.literal("closed"), reason: s.enum(["denied", "full"]) });
  const rest: Of<M>[] = message === undefined ? [] : [s.object({ kind: s.literal("message"), message })];
  return s.union([reset, saved, changed, closed, ...rest]);
}
