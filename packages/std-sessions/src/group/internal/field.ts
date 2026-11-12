/** Property `key` of `value` when it is an object that has one, else undefined. */
export function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;
}
