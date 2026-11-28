/** Each item with its place in the list as `at`, a key that stays unique when two items are alike. */
export function numbered<T extends object>(items: readonly T[]): readonly (T & { readonly at: number })[] {
  return items.map((item, at) => ({ ...item, at }));
}
