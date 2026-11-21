import type { ChannelsConfig } from "../ChannelsConfig.ts";

/**
 * Whether an open by `caller` on a channel route of serving module `module` is past a cap of that module's config,
 * counted over the open streams `sinks` of that module only: `maxStreams` (default 1,000), then, for a cookieless caller
 * (`""`, which a cookie that does not verify also yields), `perAnonymous` over all cookieless streams together (default
 * 64), else `perCaller` over that caller's (default 8).
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
    if (sk.module !== module) continue;
    all++;
    if (sk.caller === caller) mine++;
  }
  if (all >= (cfg.maxStreams ?? 1000)) return true;
  return mine >= (caller === "" ? (cfg.perAnonymous ?? 64) : (cfg.perCaller ?? 8));
}
