import type { ParamKind } from "../../internal/ParamKind.ts";

/** A param kind read from source; `unknown` when the schema is not a literal `s.*`, `line` or `para` call. */
export type ToolKind = ParamKind | "unknown";
