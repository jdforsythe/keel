/** Property `k` of `x` when `x` is an object, else undefined. */
export const field = (x: unknown, k: string): unknown =>
  typeof x === "object" && x !== null ? Reflect.get(x, k) : undefined;
