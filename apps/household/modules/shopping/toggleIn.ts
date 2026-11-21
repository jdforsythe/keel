import type { Infer } from "@keel/schema";
import type { Item } from "./Item.schema.ts";

type Row = Infer<typeof Item>;

/** Moves an item between to-buy and bought; a return to the list merges into an open item of the same name. */
export function toggleIn(items: readonly Row[], id: Row["id"]): Row[] {
  const item = items.find((i) => i.id === id);
  if (item === undefined) return [...items];
  const open = items.find((i) => !i.bought && i.name === item.name && i.id !== item.id);
  if (item.bought && open !== undefined)
    return items
      .filter((i) => i.id !== item.id)
      .map((i) => (i.id === open.id ? { ...i, qty: Math.min(99, i.qty + item.qty) } : i));
  return items.map((i) => (i.id === item.id ? { ...i, bought: !i.bought } : i));
}
