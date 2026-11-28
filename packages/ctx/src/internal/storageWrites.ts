import type { KeyValueStorage } from "../KeyValueStorage.ts";
import { sharedOfSim } from "./sharedOfSim.ts";

/**
 * The keys a sim storage (and its replicas' storage) was written through and each one's value now (null once
 * removed), by key in code-unit order (k.drive Law); empty for a storage that is not a sim's. Read by `simulate`.
 */
export function storageWrites(storage: KeyValueStorage): readonly (readonly [string, string | null])[] {
  const shared = sharedOfSim.get(storage);
  if (shared === undefined) return [];
  return [...shared.written].sort().map((key): readonly [string, string | null] => [key, shared.data.get(key) ?? null]);
}
