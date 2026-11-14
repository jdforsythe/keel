/** The native key-value store under a storage driver: `get` one value, `put` several, durable when it resolves. */
export interface Cell {
  get(key: string): Promise<string | null>;
  put(entries: readonly (readonly [string, string])[]): Promise<void>;
}
