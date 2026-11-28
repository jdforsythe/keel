import type { OutRecord } from "@keel/cli";
import { SessionRecord } from "../SessionRecord.ts";
import type { OutputFlags } from "./OutputFlags.ts";
import { clean } from "./clean.ts";
import { sessionCompact } from "./sessionCompact.ts";

const CAP = 5;
const HINT = "keel-session-action --limit";

const str = (v: unknown): string => clean(typeof v === "string" || typeof v === "number" ? String(v) : "");

/** The `session` record with every string field sanitized, or undefined when it does not parse. */
function session(r: OutRecord): SessionRecord | undefined {
  const p = SessionRecord.parse(r);
  if (!p.ok) return undefined;
  const v = p.value;
  const file = v.file === null ? null : clean(v.file);
  return {
    ...v,
    id: clean(v.id),
    fingerprint: clean(v.fingerprint),
    route: clean(v.route),
    file,
    error: v.error && clean(v.error),
  };
}

/** The diagnostic lines of OUTPUT.md: `CODE path:line:col message`, the fix hunk, `see`. */
function diag(r: OutRecord): string {
  const at = typeof r.path === "string" ? ` ${str(r.path)}:${str(r.line ?? 1)}:${str(r.col ?? 1)}` : "";
  const hunk = typeof r.fix === "string" ? r.fix.split("\n").filter((l) => !/^(?:---|\+\+\+) /.test(l)) : [];
  const fix = hunk.map((l, i) => `${i === 0 ? "  fix: " : "       "}${clean(l)}`);
  const see = typeof r.see === "string" ? [`  see: ${str(r.see)}`] : [];
  return [`${str(r.code)}${at} ${str(r.message)}`, ...fix, ...see].join("\n");
}

/** One record in compact or pretty mode; every field sanitized to one line. */
function line(r: OutRecord, pretty: boolean): string {
  if (r.kind === "diag") return diag(r);
  if (r.kind === "session") {
    const v = session(r);
    if (v === undefined) return "";
    if (!pretty) return sessionCompact(v);
    return `session ${v.fingerprint} ${v.route}: ${v.events} events, ${v.inputs} inputs, ${v.error ?? "ok"}`;
  }
  if (r.kind === "session.issue") {
    const n = typeof r.issue === "number" ? ` #${r.issue}` : "";
    return pretty
      ? `session ${str(r.fingerprint)}: ${str(r.action)} issue${n}`
      : `${str(r.fingerprint)} ${str(r.action)}${n}`;
  }
  if (r.kind === "summary") {
    const counts = typeof r.counts === "object" && r.counts !== null ? Object.entries(r.counts) : [];
    const text = counts.map(([k, v]) => `${str(v)} ${clean(k)}`).join(", ");
    if (pretty) return `${str(r.name)}: ${r.ok === true ? "passed" : "failed"}${text === "" ? "" : ` (${text})`}`;
    return [r.ok === true ? "ok" : "fail", str(r.name), text].filter((p) => p !== "").join(" ");
  }
  return "";
}

/**
 * Render `records` (docs/OUTPUT.md): grouped by kind (diagnostics by code) in order of first appearance, the summary
 * last. Compact and pretty cap each diagnostic code at 5 and other kinds only under `--limit`, then
 * `... +N more <what> (keel-session-action --limit <n>)`; json is NDJSON, capped only under `--limit`; `--quiet`
 * keeps the summary alone.
 */
export function actionText(records: readonly OutRecord[], o: OutputFlags): string {
  const groups = new Map<string, OutRecord[]>();
  for (const r of o.quiet ? [] : records) {
    if (r.kind === "summary") continue;
    const key = r.kind === "diag" ? `diag:${str(r.code)}` : r.kind;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: string[] = [];
  const json = o.mode === "json";
  for (const [key, rs] of groups) {
    const isDiag = key.startsWith("diag:");
    const cap = o.limit ?? (isDiag && !json ? CAP : rs.length);
    for (const r of rs.slice(0, cap)) out.push(json ? JSON.stringify(r) : line(r, o.mode === "pretty"));
    const what = isDiag ? key.slice(5) : key;
    if (rs.length > cap && !json) out.push(`... +${rs.length - cap} more ${what} (${HINT} ${rs.length})`);
  }
  const summary = records.filter((r) => r.kind === "summary").at(-1);
  if (summary !== undefined) out.push(json ? JSON.stringify(summary) : line(summary, o.mode === "pretty"));
  const text = out.filter((l) => l !== "").join("\n");
  return text === "" ? "" : `${text}\n`;
}
