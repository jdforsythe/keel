import type { KeelError, Result } from "@keel/schema";

/**
 * What `changed` takes as a channel (std.postgres-changes): any value with a `name` and a `params` schema, a std.channels
 * `channel` among them. std-postgres imports no type from std-channels.
 */
export type ChangedChannel<P> = {
  readonly name: string;
  readonly params: { parse(input: unknown): Result<P, KeelError<string, unknown>>; encode(value: unknown): unknown };
};
