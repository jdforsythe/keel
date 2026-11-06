import type { Summary } from "../types/Summary.ts";

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The compact/pretty trailer (docs/OUTPUT.md): `ok 0 errors, 0 warnings (1.8s)` or
 * `fail 3 errors, 1 warning (1.8s)` (time only when `ms` is given). Per-code counts follow on a second,
 * indented line (`  E1003 2, E1401 1`) when there are any: never under `quiet`, and under `code` only that
 * code's count. The trailer line itself carries no codes.
 */
export function trailer(
  s: Summary,
  opts: { readonly ms?: number; readonly quiet?: boolean; readonly code?: string },
): string[] {
  const parts = [plural(s.errors, "error"), plural(s.warnings, "warning")];
  if (s.infos > 0) parts.push(plural(s.infos, "info"));
  const time = opts.ms === undefined ? "" : ` (${(opts.ms / 1000).toFixed(1)}s)`;
  const head = `${s.ok ? "ok" : "fail"} ${parts.join(", ")}${time}`;
  if (opts.quiet === true) return [head];
  const counts = Object.entries(s.counts)
    .filter(([code, n]) => n > 0 && (opts.code === undefined || code === opts.code))
    .map(([code, n]) => `${code} ${n}`);
  return counts.length === 0 ? [head] : [head, `  ${counts.join(", ")}`];
}
