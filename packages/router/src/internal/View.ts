import type { Scope, Signal } from "@keel/reactive";
import type { KeelError } from "@keel/schema";
import type { DocHead } from "./DocHead.ts";
import type { Level } from "./Level.ts";
import type { Rec } from "./Rec.ts";

/**
 * A committed page. `data[i]` holds chain level i's loader value. `error.level` is the chain index whose
 * `errorElement` renders (-1: the root default); `bare` renders it without the layouts above (no loader ran).
 */
export type View = {
  readonly url: string;
  readonly chain: readonly Level[];
  readonly params: Rec;
  readonly search: Rec;
  readonly data: readonly Signal<unknown>[];
  readonly error: { readonly level: number; readonly bare: boolean; readonly error: KeelError<string, unknown> } | null;
  readonly scope: Scope;
  /** The document title and language this page names (k.head). */
  readonly head: DocHead;
};
