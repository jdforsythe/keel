import type { OutboxResult } from "../src/OutboxResult.ts";
import { unsafe } from "./unsafe.ts";

/**
 * Give a flushed entry's settlement the output type `O` its caller names: the output of the endpoint `send` named, or
 * for `resolve` the union of the outputs of every endpoint of the outbox.
 */
export function asResult<O>(r: OutboxResult<unknown>): OutboxResult<O> {
  return unsafe(
    "a sent value is decoded by the output schema of the entry's endpoint, the one send named or one of the outbox's endpoints for resolve, so it is of type O",
    () => r as OutboxResult<O>,
  );
}
