/** The `data` of the defect `fn` throws; `undefined` when it throws nothing. */
export function dataOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return Reflect.get(Object(e), "data");
  }
  return undefined;
}
