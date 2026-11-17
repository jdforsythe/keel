/** Call `f` on every item, also after one throws; the first error is rethrown after the last call. */
export function runAll<T>(items: readonly T[], f: (item: T) => void): void {
  let first: { readonly error: unknown } | null = null;
  for (const item of items) {
    try {
      f(item);
    } catch (error) {
      first ??= { error };
    }
  }
  if (first) throw first.error;
}
