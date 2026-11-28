import type { Infer } from "@keel/schema";
import type { Item } from "./Item.schema.ts";

type Row = Infer<typeof Item>;

/** Adds one of `name`: a name still to buy gains one in quantity, up to 99; a full list (50) or a taken id is unchanged. */
export function addTo(items: readonly Row[], p: { id: Row["id"]; name: string }): Row[] {
  const open = items.find((i) => !i.bought && i.name === p.name);
  if (open !== undefined) return items.map((i) => (i.id === open.id ? { ...i, qty: Math.min(99, i.qty + 1) } : i));
  if (items.length >= 50 || items.some((i) => i.id === p.id)) return [...items];
  return [...items, { id: p.id, name: p.name, qty: 1, bought: false, rev: 0 }];
}
