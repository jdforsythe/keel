import { codedError } from "./codedError.ts";
import { isoInstantMs } from "./isoInstantMs.ts";

/** The longest `KEEL_LOG_THROWN` reaches past the start (k.serverlog Thrown values): 24 hours. */
const MAX_AHEAD_MS = 86_400_000;

/**
 * The instant `KEEL_LOG_THROWN` names, in epoch milliseconds of the ctx clock, until which each thrown value's text is
 * also logged (k.serverlog Thrown values); `undefined` when it is unset. `start` is the ctx clock's reading when
 * `createApp` reads the environment. A value that is no ISO 8601 instant, or one more than 24 hours after `start`,
 * throws E1596, whose message holds no part of the value.
 */
export function logThrownUntil(value: string | undefined, start: number): number | undefined {
  if (value === undefined) return undefined;
  const at = isoInstantMs(value.trim());
  if (at === undefined || at - start > MAX_AHEAD_MS)
    throw codedError("E1596", "KEEL_LOG_THROWN: set an ISO 8601 instant at most 24 hours ahead, or unset it");
  return at;
}
