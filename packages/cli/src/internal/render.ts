import type { OutRecord } from "../types/OutRecord.ts";
import type { RenderOptions } from "./RenderOptions.ts";
import { registry } from "./registry.ts";

const DEFAULT_CAP = 5;
/** A bare `keel <command>` in printed text, not inside a word, a path or a package name (`@keel/ui`), nor already run by a manager. */
const COMMAND =
  /(?<![\w@/.-])(?<!(?:pnpm|npx --no|npx|yarn|bun run|bunx) )keel (?=(?:build|check|test|dev|docs|explain|scaffold|codemod|pack|review|ledger|grants|inspect|report|evidence|session|mcp)\b)/g;

const coded = (r: OutRecord): boolean => r.kind === "diag" || r.kind === "review";
const groupKey = (r: OutRecord): string => (coded(r) ? `${r.kind}:${String(r.code)}` : r.kind);

/**
 * Render normalized records. Records are grouped (diagnostics and review findings by code, others by kind) in order of first
 * appearance; the summary is last. Compact and pretty cap those per code (default 5, `--limit N`,
 * uncapped with `--verbose`) and other kinds only under `--limit`; json caps only under `--limit`.
 * `--code` drops other diagnostics; `--quiet` keeps the trailer only.
 */
export function render(records: readonly OutRecord[], o: RenderOptions): string {
  const summary = records.filter((r) => r.kind === "summary").at(-1);
  const body = o.quiet
    ? []
    : records.filter((r) => r.kind !== "summary" && (o.code === undefined || !coded(r) || r.code === o.code));
  const groups = new Map<string, OutRecord[]>();
  for (const r of body) groups.set(groupKey(r), [...(groups.get(groupKey(r)) ?? []), r]);
  const out: string[] = [];
  const line = (r: OutRecord): string => registry.get(r.kind)?.render(o.mode, r) ?? "";
  for (const [key, rs] of groups) {
    const isDiag = key.startsWith("diag:") || key.startsWith("review:");
    const uncapped = o.mode === "json" || !isDiag || o.verbose ? Number.POSITIVE_INFINITY : DEFAULT_CAP;
    const cap = o.limit ?? uncapped;
    for (const r of rs.slice(0, cap)) out.push(line(r));
    const more = rs.length - cap;
    if (more > 0 && o.mode !== "json") {
      const what = isDiag ? key.slice(key.indexOf(":") + 1) : key;
      const hint = isDiag ? `keel ${o.command} --code ${what}` : `keel ${o.command} --limit ${rs.length}`;
      out.push(`... +${more} more ${what} (${hint})`);
    }
  }
  if (summary !== undefined) out.push(line(summary));
  const joined = out.filter((l) => l !== "").join("\n");
  // A command a line names is printed as the reader runs it (k.cli): `pnpm keel build` when a manager started this run.
  const text =
    o.mode === "json" || o.keel === undefined || o.keel === "keel" ? joined : joined.replace(COMMAND, `${o.keel} `);
  return text === "" ? "" : `${text}\n`;
}
