import type { ObjectSchema, Schema } from "@keel/schema";

/**
 * A declared channel (std.channels): its module-prefixed `name`, the stream `path`, the `params` schema the stream
 * URL's search parses to (one instance per value) and the `message` schema members publish (absent: nothing can be
 * published).
 */
export interface Channel<P, M = never> {
  readonly name: string;
  readonly path: string;
  readonly params: ObjectSchema<P>;
  readonly message?: Schema<M>;
}
