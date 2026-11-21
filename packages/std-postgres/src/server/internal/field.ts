/** Driver error `e`'s string property `name`, `""` when absent or not a string. */
export function field(e: unknown, name: string): string {
  const v: unknown = typeof e === "object" && e !== null ? Reflect.get(e, name) : undefined;
  return typeof v === "string" ? v : "";
}
