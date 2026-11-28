type Pair = { readonly name: string; readonly key: string };

/**
 * The `{ name, key }` of the latest `limit` commits made with a `key`, oldest first (k.sync Write key), with a count
 * per pair, so a lookup and an add cost the same however large `limit` is. The oldest pair is dropped by moving a head
 * index; the dropped slots are cut off once they outnumber the held pairs, so a drop costs O(1) amortised.
 */
export function keyWindow(limit: number) {
  let list: Pair[] = [];
  let head = 0;
  const held = new Map<string, number>();
  const id = (p: Pair): string => JSON.stringify([p.name, p.key]);
  const add = (p: Pair): void => {
    list.push({ name: p.name, key: p.key });
    held.set(id(p), (held.get(id(p)) ?? 0) + 1);
    if (list.length - head <= limit) return;
    const old = list[head];
    head++;
    if (head > 64 && head * 2 > list.length) {
      list = list.slice(head);
      head = 0;
    }
    if (old === undefined) return;
    const n = (held.get(id(old)) ?? 1) - 1;
    if (n > 0) held.set(id(old), n);
    else held.delete(id(old));
  };
  return {
    has: (p: Pair): boolean => held.has(id(p)),
    add,
    /** Replace the pairs with the latest `limit` of `pairs`. */
    reset(pairs: readonly Pair[]): void {
      list = [];
      head = 0;
      held.clear();
      for (const p of pairs.slice(-limit)) add(p);
    },
    list: (): Pair[] => list.slice(head).map((p) => ({ name: p.name, key: p.key })),
  };
}
