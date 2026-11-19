import type { Outcome } from "../internal/Outcome.ts";
import type { Input } from "./Input.ts";
import type { Io } from "./Io.ts";
import type { Operation } from "./Operation.ts";

/**
 * An operation a stdlib package fills into a reserved command slot (`stdCommand`): a normal `Operation` plus `run`,
 * which gets the schema-valid input and returns what the kernel commands return (records to render, file effects).
 */
export type StdOperation = Operation & {
  readonly run: (input: Input, io: Io) => Promise<Outcome>;
};
