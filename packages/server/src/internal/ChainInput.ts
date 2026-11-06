import type { Ctx } from "@keel/ctx";
import type { Level } from "@keel/router";
import type { JsonValue, KeelError } from "@keel/schema";
import type { Failure } from "./Failure.ts";
import type { Rec } from "./Rec.ts";

/** What `renderChain` renders: the chain with its props, per-level loader data, and an optional failure. */
export type ChainInput = {
  readonly chain: readonly Level[];
  readonly params: Rec;
  readonly search: Rec;
  /** Parsed loader value per chain level. */
  readonly data: readonly unknown[];
  /** Island props (schema-encoded params, search, data) per chain level. */
  readonly props: (level: number) => JsonValue;
  readonly failure: Failure | null;
  /** HTML placed before the route (last level) component's output, e.g. the 422 field summary. */
  readonly prepend: string;
  readonly ctx: Ctx;
  /** The error as it may leave the server (production scrubs `keel.unexpected`). */
  readonly publicize: (e: KeelError<string, unknown>) => KeelError<string, unknown>;
};
