import type { Infer } from "@keel/schema";
import type { Item } from "./Item.schema.ts";

type Row = Infer<typeof Item>;

/**
 * Puts `name` back on the list: a name still to buy stays as it is; else a bought item of that name goes back to buy,
 * one of it; else a new item of one joins the list, unless the list holds 50.
 */
export function putBackIn(items: readonly Row[], p: { id: Row["id"]; name: string }): Row[] {
  if (items.some((i) => !i.bought && i.name === p.name)) return [...items];
  const old = items.find((i) => i.bought && i.name === p.name);
  if (old !== undefined) return items.map((i) => (i.id === old.id ? { ...i, qty: 1, bought: false } : i));
  if (items.length >= 50 || items.some((i) => i.id === p.id)) return [...items];
  return [...items, { id: p.id, name: p.name, qty: 1, bought: false, rev: 0 }];
}
