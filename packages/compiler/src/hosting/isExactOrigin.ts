import { originOf } from "./originOf.ts";

/**
 * Whether `value` is an exact origin (k.origins Declaration): its own serialization (`originOf`: scheme, lowercase
 * host, a port only when not the default; no path, `/`, query, fragment, credentials or `*`), with scheme `https`,
 * or `http` on host `localhost`, and a host that is not an IPv6 literal, which a CSP host-source cannot write.
 */
export function isExactOrigin(value: string): boolean {
  return originOf(value) === value && !value.includes("[") && /^(?:https:|http:\/\/localhost(?::\d+)?$)/.test(value);
}
