import type { JsonValue } from "@keel/schema";
import type { StdData } from "../types/StdData.ts";
import { clientStdPackages } from "./clientStdPackages.ts";

/** `config` with only `keys` (all when `undefined`); a non-object config passes as is. */
const pick = (config: JsonValue, keys: readonly string[] | undefined): JsonValue =>
  keys === undefined || typeof config !== "object" || config === null || Array.isArray(config)
    ? config
    : Object.fromEntries(Object.entries(config).filter(([k]) => keys.includes(k)));

/**
 * The part of `std.json` data a browser may read (rfc:0069): packages declared with `clientStd`, in each only the
 * modules in `modules` (the served deployable's), and of each module's config only the keys `clientStd` named
 * (rfc:0070). A package left with no module is dropped; `{}` when none remains.
 */
export function clientStdData(data: StdData, modules: ReadonlySet<string>): StdData {
  const out: [string, StdData[string]][] = [];
  for (const pkg of Object.keys(data).sort()) {
    if (!clientStdPackages.has(pkg)) continue;
    const keys = clientStdPackages.get(pkg);
    const byModule = Object.entries(data[pkg] ?? {})
      .filter(([id]) => modules.has(id))
      .map(([id, config]): [string, JsonValue] => [id, pick(config, keys)]);
    if (byModule.length > 0) out.push([pkg, Object.fromEntries(byModule)]);
  }
  return Object.fromEntries(out);
}
