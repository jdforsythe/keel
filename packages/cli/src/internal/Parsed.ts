import type { Input } from "../types/Input.ts";
import type { Mode } from "../types/Mode.ts";
import type { Operation } from "../types/Operation.ts";
import type { Diag } from "./Diag.ts";

/** argv parsed against the command table: an operation and its schema-valid input, or usage diagnostics. */
export type Parsed =
  | { readonly ok: true; readonly op: Operation; readonly input: Input }
  | {
      readonly ok: false;
      readonly command: string;
      readonly format: Mode | undefined;
      readonly diags: readonly Diag[];
    };
