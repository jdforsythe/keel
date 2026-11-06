import type { Summary } from "../types/Summary.ts";

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The one-line compact trailer: `ok check: 0 errors, 0 warnings` or
 * `fail check: 3 errors, 1 warning (E1003=2, E1501=1, W2001=1)`, plus `(1.8s)` when `ms` is given.
 */
export function trailer(s: Summary, ms?: number): string {
  const parts = [plural(s.errors, "error"), plural(s.warnings, "warning")];
  if (s.infos > 0) parts.push(plural(s.infos, "info"));
  const counts = Object.entries(s.counts)
    .map(([code, n]) => `${code}=${n}`)
    .join(", ");
  const time = ms === undefined ? "" : ` (${(ms / 1000).toFixed(1)}s)`;
  return `${s.ok ? "ok" : "fail"} check: ${parts.join(", ")}${counts === "" ? "" : ` (${counts})`}${time}`;
}
