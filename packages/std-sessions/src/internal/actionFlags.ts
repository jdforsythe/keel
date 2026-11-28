import type { OutputFlags } from "./OutputFlags.ts";

/**
 * Parse `--format=compact|json|pretty`, `--quiet` and `--limit N` (or `--limit=N`). The default mode is compact when
 * stdout is not a TTY or `KEEL_AGENT=1`, else pretty. Anything else is a reason string for E1052.
 */
export function actionFlags(
  args: readonly string[],
  env: Readonly<Record<string, string>>,
  tty: boolean,
): { readonly ok: true; readonly value: OutputFlags } | { readonly ok: false; readonly why: string } {
  let mode: OutputFlags["mode"] = !tty || env.KEEL_AGENT === "1" ? "compact" : "pretty";
  let quiet = false;
  let limit: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    const format = /^--format=(compact|json|pretty)$/.exec(a)?.[1];
    if (format === "compact" || format === "json" || format === "pretty") mode = format;
    else if (a === "--quiet") quiet = true;
    else if (a === "--limit" || a.startsWith("--limit=")) {
      const raw = a === "--limit" ? args[++i] : a.slice(8);
      if (raw === undefined || !/^\d{1,6}$/.test(raw)) return { ok: false, why: "--limit needs a whole number" };
      limit = Number(raw);
    } else return { ok: false, why: `unknown flag ${a.slice(0, 30)}` };
  }
  return { ok: true, value: { mode, quiet, limit } };
}
