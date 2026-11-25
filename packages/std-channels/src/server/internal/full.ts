import type { ChannelsConfig } from "../ChannelsConfig.ts";

/**
 * Whether an open by `caller` on a channel route of serving module `module` is past a cap of that module's config
 * (std.channels-limits): `maxStreams` (default 1,000) over that module's open streams, then, for a cookieless caller
 * (`""`, which a cookie that does not verify also yields), `perAnonymous` (default 64) over the cookieless streams of
 * every module in `sinks` (the process's), else `perCaller` (default 8) over that caller's streams on that module.
 */
export function full(
  sinks: Iterable<{ readonly caller: string; readonly module: string }>,
  caller: string,
  module: string,
  cfg: ChannelsConfig,
): boolean {
  let all = 0;
  let mine = 0;
  for (const sk of sinks) {
    // Cookieless streams are counted over every module; the others over this module's only.
    if (caller === "" && sk.caller === "") mine++;
    if (sk.module !== module) continue;
    all++;
    if (caller !== "" && sk.caller === caller) mine++;
  }
  if (all >= (cfg.maxStreams ?? 1000)) return true;
  return mine >= (caller === "" ? (cfg.perAnonymous ?? 64) : (cfg.perCaller ?? 8));
}
