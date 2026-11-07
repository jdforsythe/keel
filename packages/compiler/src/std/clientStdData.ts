import type { StdData } from "../types/StdData.ts";
import { clientStdPackages } from "./clientStdPackages.ts";

/**
 * The part of `std.json` data a browser may read (rfc:0069): packages declared with `clientStd`, and in each only the
 * modules in `modules` (the served deployable's). A package left with no module is dropped; `{}` when none remains.
 */
export function clientStdData(data: StdData, modules: ReadonlySet<string>): StdData {
  const out: [string, StdData[string]][] = [];
  for (const pkg of Object.keys(data).sort()) {
    if (!clientStdPackages.has(pkg)) continue;
    const byModule = Object.entries(data[pkg] ?? {}).filter(([id]) => modules.has(id));
    if (byModule.length > 0) out.push([pkg, Object.fromEntries(byModule)]);
  }
  return Object.fromEntries(out);
}
