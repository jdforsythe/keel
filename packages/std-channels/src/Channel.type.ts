import type { ObjectSchema, Schema } from "@keel/schema";
import type { ChannelEvent } from "./ChannelEvent.ts";

/**
 * A declared channel (std.channels): its module-prefixed `name`, the stream `path`, the `params` schema the stream
 * URL's search parses to (one instance per value) and the `message` schema members publish (absent: nothing can be
 * published). `events` and `body` are the schemas its contract entries name (std.contracts): the stream entry's
 * `output` and, with `message`, the publish entry's `body` `{ message }`.
 */
export interface Channel<P, M = never> {
  readonly name: string;
  readonly path: string;
  readonly params: ObjectSchema<P>;
  readonly message?: Schema<M>;
  readonly events: Schema<ChannelEvent<M>>;
  readonly body: [M] extends [never] ? undefined : ObjectSchema<{ message: M }>;
}
