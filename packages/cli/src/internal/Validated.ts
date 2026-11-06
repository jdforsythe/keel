import type { Input } from "../types/Input.ts";
import type { Diag } from "./Diag.ts";

/** Structured arguments checked against an operation's input schema. */
export type Validated =
  | { readonly ok: true; readonly input: Input }
  | { readonly ok: false; readonly diags: readonly Diag[] };
