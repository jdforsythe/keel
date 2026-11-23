import { type Result, err } from "@keel/schema";
import type { ScaffoldDiag } from "../types/ScaffoldDiag.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";

/** Refuse an operation with one diagnostic, at `at` in `path` when given, else at its first character. */
export function fail(
  code: string,
  path: string,
  message: string,
  cause?: ScaffoldDiag["cause"],
  at: { readonly line: number; readonly col: number } = { line: 1, col: 1 },
): Result<never, ScaffoldError> {
  const base = { kind: "diag", code, path, line: at.line, col: at.col, message, see: "k.scaffold" } as const;
  const data: ScaffoldDiag = cause === undefined ? base : { ...base, cause };
  return err({ code: "scaffold.rejected", message: `${code} ${message}`, data });
}
