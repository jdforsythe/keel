import type { Infer } from "@keel/schema";
import type { DepsReport } from "../evidence/DepsReport.ts";
import { isRecord } from "./isRecord.ts";

type Advisory = NonNullable<Infer<typeof DepsReport>["advisories"]>[number];

const FIELDS = ["module_name", "severity", "title", "url", "vulnerable_versions", "patched_versions"] as const;

/**
 * The advisories of a `pnpm audit --json` document (k.evidence `--audit`), by id: undefined when `text` is absent, not
 * JSON, or not that shape (an object with `advisories`, each advisory with an integer `id` and its text fields, and
 * `metadata.vulnerabilities`), which is E1064.
 */
export function auditAdvisories(text: string | undefined): Advisory[] | undefined {
  let doc: unknown;
  try {
    doc = text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(doc) || !isRecord(doc.advisories) || !isRecord(doc.metadata) || !isRecord(doc.metadata.vulnerabilities))
    return undefined;
  const out: Advisory[] = [];
  for (const a of Object.values(doc.advisories)) {
    if (!isRecord(a) || typeof a.id !== "number" || !Number.isInteger(a.id)) return undefined;
    const text: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = a[f];
      if (typeof v !== "string") return undefined;
      text[f] = v;
    }
    out.push({
      id: a.id,
      module: text.module_name ?? "",
      severity: text.severity ?? "",
      title: text.title ?? "",
      url: text.url ?? "",
      vulnerable: text.vulnerable_versions ?? "",
      patched: text.patched_versions ?? "",
    });
  }
  return out.sort((x, y) => x.id - y.id);
}
