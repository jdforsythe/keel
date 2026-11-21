import type { ObjectSchema, Schema } from "@keel/schema";
import type { ChannelEvent } from "../ChannelEvent.ts";

/** The stream entry of a channel: an `events: true` API GET on its path, its `params` the `query`. */
export type StreamEntry<P, M> = {
  readonly method: "GET";
  readonly path: string;
  readonly query: ObjectSchema<P>;
  readonly events: true;
  readonly output: Schema<ChannelEvent<M>>;
};
