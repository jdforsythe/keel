import { type Computed, computed } from "@keel/reactive";

/**
 * One row object per key, the same object for as long as the key is in `list`: a `For` over these keeps each row's
 * nodes when the app replaces an item, and the row reads the item's current values through its own bindings.
 */
export function stableRows<T, K extends string>(
  list: () => readonly T[],
  keyOf: (item: T) => K,
): Computed<readonly { readonly key: K }[]> {
  let kept = new Map<K, { readonly key: K }>();
  return computed(() => {
    const next = new Map<K, { readonly key: K }>();
    const rows = list().map((item) => {
      const key = keyOf(item);
      const row = kept.get(key) ?? { key };
      next.set(key, row);
      return row;
    });
    kept = next;
    return rows;
  });
}
