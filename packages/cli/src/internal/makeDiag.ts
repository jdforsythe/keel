import type { Diag } from "./Diag.ts";
import { clipMessage } from "./clipMessage.ts";

type Loc = {
  readonly path?: string | undefined;
  readonly line?: number | undefined;
  readonly col?: number | undefined;
  readonly fix?: string | undefined;
  readonly see?: string | undefined;
};

/** Build a diagnostic record, keeping absent optional fields absent (exact optional properties). */
export function makeDiag(code: string, message: string, loc: Loc = {}): Diag {
  return {
    kind: "diag",
    code,
    ...(loc.path === undefined ? {} : { path: loc.path }),
    ...(loc.line === undefined ? {} : { line: loc.line }),
    ...(loc.col === undefined ? {} : { col: loc.col }),
    message: clipMessage(message),
    ...(loc.fix === undefined ? {} : { fix: loc.fix }),
    ...(loc.see === undefined ? {} : { see: loc.see }),
  };
}
