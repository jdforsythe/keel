/**
 * A part of a `contract(id, entries)` call the static readers do not read (k.contract Static reading), at
 * `[start, end)` of its file: `entries` not an object literal; a `spread` or a computed `key` among the entries
 * (`id` null) or in entry `id`; an `entry` that is not an object literal; or entry `id`'s `method`, `path`, `layout`
 * or `events` not a literal. W1005 names it and E1111 is at it.
 */
export type ContractGap = {
  readonly kind: "gap";
  readonly part: "entries" | "spread" | "key" | "entry" | "method" | "path" | "layout" | "events";
  readonly id: string | null;
  readonly start: number;
  readonly end: number;
};
