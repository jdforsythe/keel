import type { OutRecord } from "@keel/cli";
import { SessionRecord } from "../SessionRecord.ts";
import { sessionCompact } from "./sessionCompact.ts";

const CAP = 5;

/** One compact line (docs/OUTPUT.md) for a record of `keel-session-action`. */
function line(r: OutRecord): string {
  if (r.kind === "session") {
    const p = SessionRecord.parse(r);
    return p.ok ? sessionCompact(p.value) : "";
  }
  if (r.kind === "session.issue")
    return `${String(r.fingerprint)} ${String(r.action)}${typeof r.issue === "number" ? ` #${r.issue}` : ""}`;
  if (r.kind === "diag") {
    const at = typeof r.path === "string" ? ` ${r.path}:${String(r.line ?? 1)}:${String(r.col ?? 1)}` : "";
    const see = typeof r.see === "string" ? `\n  see: ${r.see}` : "";
    return `${String(r.code)}${at} ${String(r.message)}${see}`;
  }
  if (r.kind === "summary") {
    const counts = typeof r.counts === "object" && r.counts !== null ? Object.entries(r.counts) : [];
    const text = counts.map(([k, v]) => `${String(v)} ${k}`).join(", ");
    return [r.ok === true ? "ok" : "fail", String(r.name), text].filter((p) => p !== "").join(" ");
  }
  return "";
}

/**
 * The compact rendering of `records`: grouped by kind (diagnostics by code) in order of first appearance, at most 5
 * diagnostics per code then `... +N more <code>`, the summary last.
 */
export function actionText(records: readonly OutRecord[]): string {
  const groups = new Map<string, OutRecord[]>();
  for (const r of records) {
    if (r.kind === "summary") continue;
    const key = r.kind === "diag" ? `diag:${String(r.code)}` : r.kind;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: string[] = [];
  for (const [key, rs] of groups) {
    const cap = key.startsWith("diag:") ? CAP : rs.length;
    for (const r of rs.slice(0, cap)) out.push(line(r));
    if (rs.length > cap) out.push(`... +${rs.length - cap} more ${key.slice(5)}`);
  }
  const summary = records.filter((r) => r.kind === "summary").at(-1);
  if (summary !== undefined) out.push(line(summary));
  const text = out.filter((l) => l !== "").join("\n");
  return text === "" ? "" : `${text}\n`;
}
