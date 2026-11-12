import type { OutboxResult } from "../src/OutboxResult.ts";
import { unsafe } from "./unsafe.ts";

/** Give a flushed entry's settlement the output type of the endpoint `send` named. */
export function asResult<O>(r: OutboxResult<unknown>): OutboxResult<O> {
  return unsafe("a sent value is decoded by the output schema of the endpoint send named", () => r as OutboxResult<O>);
}
