import type { Ctx } from "@keel/ctx";
import { s } from "@keel/schema";
import { stdIssue } from "../internal/stdIssue.ts";
import type { StdData } from "../types/StdData.ts";
import { stdBindings } from "./stdBindings.ts";

const clip = (x: string): string => (x.length > 24 ? `${x.slice(0, 21)}...` : x);

/**
 * Bind `std.json` data to `ctx` for `stdConfig` (k.module Std config, rfc:0066; `createApp({ std })` calls it once at
 * startup). Throws E1158 (an Error with `code`, message naming package, module and path) for the first value failing
 * the schema registered under its package; packages that registered none are validated when read.
 */
export function bindStd(ctx: Ctx, data: StdData): void {
  const registry = s.registry();
  for (const pkg of Object.keys(data).sort()) {
    const byModule = data[pkg] ?? {};
    for (const id of Object.keys(byModule).sort()) {
      const issue = stdIssue(registry.get(pkg), byModule[id]);
      if (issue === undefined) continue;
      const message = `E1158 std config for ${clip(pkg)} in module ${clip(id)} fails its schema ${issue}`;
      throw Object.assign(new Error(message), { code: "E1158" });
    }
  }
  stdBindings.set(ctx, data);
}
