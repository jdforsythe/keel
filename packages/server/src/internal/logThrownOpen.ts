import { isoInstantMs } from "./isoInstantMs.ts";

/** The longest `KEEL_LOG_THROWN` reaches past the start (k.serverlog Thrown values): 24 hours. */
const MAX_AHEAD_MS = 86_400_000;

/**
 * Whether a throw before `createApp` has read the environment prints its text (k.serverlog Thrown values): `now`, the
 * ctx clock's reading at the throw, stands for the start too, so the window is open when `value` is an ISO 8601
 * instant after `now` and at most 24 hours after it. Any other value, unset or empty among them, is closed, and
 * raises nothing here: E1596 is `createApp`'s.
 */
export function logThrownOpen(value: string | undefined, now: number): boolean {
  if (value === undefined) return false;
  const at = isoInstantMs(value.trim());
  return at !== undefined && now < at && at - now <= MAX_AHEAD_MS;
}
