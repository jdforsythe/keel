import type { ObjectSchema, Schema } from "@keel/schema";
import type { CommandName } from "./CommandName.ts";
import type { Input } from "./Input.ts";

/**
 * One command, defined once and served by every surface (k.cli "One engine").
 * `input` parses binary flags (via decodeStrings) and MCP arguments alike; `positional` names the input fields
 * filled from bare argv words, in order (an array field takes the rest). `output` is the record stream.
 */
export type Operation = {
  readonly name: CommandName;
  readonly description: string;
  readonly input: ObjectSchema<Input>;
  readonly output: Schema<unknown>;
  readonly positional: readonly string[];
};
