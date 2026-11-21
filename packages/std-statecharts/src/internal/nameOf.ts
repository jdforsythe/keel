/** The state name an explored chart state holds, or undefined for a value that is not a chart state. */
export function nameOf(value: unknown): string | undefined {
  return typeof value === "object" && value !== null && "state" in value && typeof value.state === "string"
    ? value.state
    : undefined;
}
