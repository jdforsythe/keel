/** Key-value storage capability. `get` resolves null for a missing key. */
export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
