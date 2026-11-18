import type { ChannelsConfig } from "../ChannelsConfig.ts";

/**
 * Whether an open by `caller` is past a cap, counted over the open streams `sinks`: `maxStreams` for the process
 * (default 1,000), then, for a cookieless caller (`""`, which a cookie that does not verify also yields),
 * `perAnonymous` over all cookieless streams together (default 64), else `perCaller` over that caller's (default 8).
 */
export function full(sinks: Iterable<{ readonly caller: string }>, caller: string, cfg: ChannelsConfig): boolean {
  let all = 0;
  let mine = 0;
  for (const sk of sinks) {
    all++;
    if (sk.caller === caller) mine++;
  }
  if (all >= (cfg.maxStreams ?? 1000)) return true;
  return mine >= (caller === "" ? (cfg.perAnonymous ?? 64) : (cfg.perCaller ?? 8));
}
