import { originOf } from "./originOf.ts";

/**
 * Whether `value` is an exact origin (k.origins Declaration): its own serialization (`originOf`: scheme, lowercase
 * host, a port only when not the default; no path, `/`, query, fragment, credentials or `*`), with scheme `https`,
 * or `http` on host `localhost`.
 */
export function isExactOrigin(value: string): boolean {
  return originOf(value) === value && /^(?:https:|http:\/\/localhost(?::\d+)?$)/.test(value);
}
