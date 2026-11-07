import type { NumRef } from "./NumRef.ts";
import type { PropRun } from "./PropRun.ts";
import type { Use } from "./Use.ts";

/**
 * Static facts of one test or helper file (k.testing Ledger evidence): imports (local binding -> source module and
 * imported name, `default` or `*` for namespaces), top-level numeric constants and options objects, top-level helper functions, the
 * bodies of its non-skipped `it`/`test` calls, and `fc.configureGlobal` defaults.
 */
export type FileFacts = {
  readonly imports: ReadonlyMap<string, { readonly from: string; readonly name: string }>;
  readonly consts: ReadonlyMap<string, NumRef>;
  readonly objects: ReadonlyMap<string, ReadonlyMap<string, NumRef>>;
  readonly helpers: ReadonlyMap<string, Use>;
  readonly tests: readonly Use[];
  readonly global: PropRun;
};
