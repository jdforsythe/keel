import type { Schema } from "@keel/schema";
import type { Method } from "./Method.ts";

/**
 * One declared HTTP operation (k.services). `path` names params as `:name`; `params`, `query` and `body`
 * type the input, `output` the 2xx body (each event of an `events` endpoint), `errors` the body of each declared
 * non-2xx status. `timeout` (ms) overrides the service timeout. `events: true` on a GET reads a k.server live loader's
 * event stream.
 */
export interface Endpoint {
  readonly method: Method;
  readonly path: string;
  readonly params?: Schema<unknown, boolean>;
  readonly query?: Schema<unknown, boolean>;
  readonly body?: Schema<unknown, boolean>;
  readonly output: Schema<unknown, boolean>;
  readonly errors?: Readonly<Record<number, Schema<unknown, boolean>>>;
  readonly timeout?: number;
  readonly events?: boolean;
}
