import type { JsonValue, KeelError } from "@keel/schema";

/**
 * A rendered chain: its `html`, the props of each island root it marked (`data-k-island`, keyed by route
 * id), and the first error a route boundary caught while rendering (status 500), if any.
 */
export type Rendered = {
  readonly html: string;
  readonly islands: Readonly<Record<string, JsonValue>>;
  /** Ids of the stores an island level's render created, looked up through `stores()` or read (k.leave Snapshots). */
  readonly touched: ReadonlySet<string>;
  readonly caught: KeelError<string, unknown> | null;
  /** What was thrown for `caught`, as thrown, for its log records (k.serverlog Thrown values); `null` with no `caught`. */
  readonly thrown: { readonly value: unknown } | null;
  /** A level's render placed an element made before the op placing it (E1257). */
  readonly eager: boolean;
  /** A level's render had a text binding that renders nothing (E1406). */
  readonly nothing: boolean;
};
