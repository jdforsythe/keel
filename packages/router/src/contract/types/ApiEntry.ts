import type { ObjectSchema, Schema } from "@keel/schema";
import type { Method } from "./Method.ts";

/** An API entry (k.contract, k.api): the k.services endpoint shape, one id per method. */
export type ApiEntry = {
  readonly method: Method;
  readonly path: string;
  readonly params?: ObjectSchema<unknown>;
  readonly query?: ObjectSchema<unknown>;
  readonly body?: ObjectSchema<unknown>;
  readonly output: Schema<unknown, boolean>;
  readonly errors?: Readonly<Record<number, Schema<unknown, boolean>>>;
  readonly timeout?: number;
  readonly events?: boolean;
  /** Answered only over a loopback connection with a loopback `Host` and an own-site navigation (k.contract Local routes). */
  readonly local?: true;
};
