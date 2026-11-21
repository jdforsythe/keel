import { AGENTS_END, AGENTS_START, agentFiles } from "@keel/scaffold/agents";
import type { Diag } from "../internal/Diag.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { readDocs } from "./readDocs.ts";

const W = (path: string, message: string): Diag =>
  makeDiag("W1356", message, { path, line: 1, col: 1, see: "k.scaffold" });

/**
 * W1356 for `keel check` (k.scaffold Agent files): only where `AGENTS.md` holds a Keel marker line, one per agent file
 * `keel docs --sync` would change (`CLAUDE.md` aside), or one at `AGENTS.md` when the block is malformed.
 */
export function agentWarnings(files: readonly SourceFile[]): Diag[] {
  const agents = files.find((f) => f.path === "AGENTS.md")?.source ?? "";
  const marked = agents.split("\n").some((l) => [AGENTS_START, AGENTS_END].includes(l.replace(/\r$/, "")));
  if (!marked) return [];
  const docs = readDocs(files);
  const r = agentFiles(docs.files, docs.skills);
  if (!r.ok) return [W("AGENTS.md", "Keel block malformed; fix the markers, then keel docs --sync")];
  return r.value
    .filter((f) => f.path !== "CLAUDE.md")
    .map((f) => W(f.path, `${f.have === null ? "missing" : "stale"} agent file; run keel docs --sync`));
}
