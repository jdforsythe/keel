import { agentFiles } from "@keel/scaffold/agents";
import type { Outcome } from "../internal/Outcome.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import { summary } from "../internal/summary.ts";
import type { InstalledDocs } from "./InstalledDocs.ts";

/**
 * `keel docs --sync` (k.scaffold Agent files): writes every agent file that differs from the running `@keel/cli`'s,
 * all or none; a malformed Keel block is E1355 and nothing is written.
 */
export function agentSync(docs: InstalledDocs): Outcome {
  const r = agentFiles(docs.files, docs.skills);
  if (!r.ok) {
    const e = r.error.data;
    const d = makeDiag(e.code, e.message, { path: e.path, line: e.line, col: e.col, see: e.see });
    return { records: [d, summary("docs --sync", [d], {})], writes: [] };
  }
  const records = r.value.map((f) => ({
    kind: "scaffold.edit",
    action: f.have === null ? "create" : "change",
    path: f.path,
  }));
  const created = r.value.filter((f) => f.have === null).length;
  return {
    records: [...records, summary("docs --sync", [], { created, changed: r.value.length - created })],
    writes: r.value.map((f) => ({ path: f.path, content: f.want, readonly: false })),
  };
}
