/** Kernel code blocks and their owning spec section (spec/00-map.md Code ranges): E1000-E1799 in 50s, then E18xx, E19xx. */
const BLOCKS: readonly (readonly [number, string])[] = [
  [1000, "k.compiler"],
  [1050, "k.cli"],
  [1100, "k.schema"],
  [1150, "k.module"],
  [1200, "k.reactive"],
  [1250, "k.runtime"],
  [1300, "k.store"],
  [1350, "k.scaffold"],
  [1400, "k.component"],
  [1450, "k.errors"],
  [1500, "k.router"],
  [1550, "k.server"],
  [1600, "k.ctx"],
  [1650, "k.services"],
  [1700, "k.testing"],
  [1750, "k.check"],
  [1800, "k.ui"],
  [1900, "k.forms"],
];

/** Codes whose rule lives outside their block's section. */
const MOVED: ReadonlyMap<string, string> = new Map([
  ["E1406", "k.place"],
  ["E1508", "k.guards"],
  ["E1558", "k.topology"],
]);

/**
 * The spec section owning a kernel diagnostic `code` (`E1508` -> `k.guards`, `E1558` -> `k.topology`); `k.server` for
 * any other code.
 */
export function seeOf(code: string): string {
  const moved = MOVED.get(code);
  if (moved !== undefined) return moved;
  const digits = /^E(1\d{3})$/.exec(code)?.[1];
  const n = digits === undefined ? undefined : Number(digits);
  let see = "k.server";
  if (n !== undefined) for (const [start, owner] of BLOCKS) if (start <= n) see = owner;
  return see;
}
