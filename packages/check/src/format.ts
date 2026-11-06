import { groupByCode } from "./internal/groupByCode.ts";
import { normalize } from "./internal/normalize.ts";
import { summarize } from "./internal/summarize.ts";
import { trailer } from "./internal/trailer.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { FormatOptions } from "./types/FormatOptions.ts";
import type { Summary } from "./types/Summary.ts";

const CAP = 5;
const where = (d: Diagnostic): string => `${d.path}:${d.line}:${d.col}`;
const more = (code: string, n: number): string => `... +${n} more ${code} (keel check --code ${code})`;

/** Most changed lines a compact fix shows inline; a longer patch is pointed to instead (token budget). */
const FIX_LINES = 6;

/** Fix lines for compact: only `-`/`+` lines (file and hunk headers and context dropped), or a pointer. */
function compactFix(d: Diagnostic, fix: string): string[] {
  const lines = fix.split("\n");
  const headers = lines[0]?.startsWith("--- ") === true && lines[1]?.startsWith("+++ ") === true ? 2 : 0;
  const body = lines.slice(headers).filter((l) => /^[-+]/.test(l));
  if (body.length > FIX_LINES) return [`  fix: ${body.length}-line patch (keel check --format=json --code ${d.code})`];
  return body.map((l, i) => (i === 0 ? `  fix: ${l}` : `       ${l}`));
}

function capped(diags: readonly Diagnostic[], per: number, render: (d: Diagnostic) => string[]): string[] {
  const out: string[] = [];
  for (const [code, group] of groupByCode(diags)) {
    for (const d of group.slice(0, per)) out.push(...render(d));
    if (group.length > per) out.push(more(code, group.length - per));
  }
  return out;
}

function json(shown: readonly Diagnostic[], summary: Summary, opts: FormatOptions, per: number | undefined): string {
  const list =
    opts.quiet === true ? [] : per === undefined ? shown : groupByCode(shown).flatMap(([, g]) => g.slice(0, per));
  const tail = opts.ms === undefined ? summary : { ...summary, ms: Math.round(opts.ms) };
  return [...list.map((d) => JSON.stringify(d)), JSON.stringify(tail)].join("\n");
}

function pretty(d: Diagnostic): string[] {
  const out = [`${d.code}  ${d.message}`, `  at ${where(d)}${d.see === undefined ? "" : `  (see ${d.see})`}`];
  if (d.fix !== undefined) out.push("  fix:", ...d.fix.split("\n").map((l) => `    ${l}`));
  out.push("");
  return out;
}

/**
 * Render diagnostics per docs/OUTPUT.md. Always dedupes and sorts first; the summary counts every code
 * even under `code`. `compact` (default): one line per diagnostic grouped by code, cap per code then a
 * `... +N more` line, fix as `-`/`+` lines, then the trailer (`ok|fail N errors, M warnings`) and an indented per-code
 * counts line; silent on pass except the trailer. `json`:
 * NDJSON diagnostics then a summary line (uncapped unless `limit` is set). `pretty`: blocks for humans.
 * No ANSI, no timestamps; equal inputs give byte-identical output.
 */
export function format(diags: readonly Diagnostic[], opts: FormatOptions = {}): string {
  const all = normalize(diags);
  const summary = summarize(all);
  const shown = opts.code === undefined ? all : all.filter((d) => d.code === opts.code);
  const given = opts.limit !== undefined && Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : undefined;
  const mode = opts.mode ?? "compact";
  if (mode === "json") return json(shown, summary, opts, given);
  const per = given ?? CAP;
  const quiet = opts.quiet === true;
  if (mode === "pretty") {
    const body = quiet ? [] : capped(shown, per, pretty);
    return [...body, ...trailer(summary, opts)].join("\n");
  }
  const body = quiet
    ? []
    : capped(shown, per, (d) => [
        `${d.code} ${where(d)} ${d.message}`,
        ...(d.fix === undefined ? [] : compactFix(d, d.fix)),
      ]);
  return [...body, ...trailer(summary, opts)].join("\n");
}
