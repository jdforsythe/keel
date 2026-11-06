import type { LspState } from "./LspState.ts";
import { diffEdits } from "./diffEdits.ts";
import { isRecord } from "./isRecord.ts";
import { lspDiagnostic } from "./lspDiagnostic.ts";

/** `textDocument/codeAction`: one quick fix per diagnostic in the range that carries a `fix` diff (k.cli). */
export function lspCodeActions(state: LspState, root: string, params: unknown): Record<string, unknown>[] {
  const p = isRecord(params) ? params : {};
  const doc = isRecord(p.textDocument) ? p.textDocument : {};
  const range = isRecord(p.range) ? p.range : {};
  const lineOf = (pos: unknown, fallback: number): number =>
    isRecord(pos) && typeof pos.line === "number" ? pos.line : fallback;
  const from = lineOf(range.start, 0);
  const to = lineOf(range.end, Number.MAX_SAFE_INTEGER);
  const uri = typeof doc.uri === "string" ? doc.uri : "";
  return (state.diags.get(uri) ?? []).flatMap((d) => {
    const line = (d.line ?? 1) - 1;
    if (d.fix === undefined || line < from || line > to) return [];
    const changes = Object.fromEntries([...diffEdits(d.fix)].map(([path, edits]) => [`file://${root}/${path}`, edits]));
    return [
      { title: `Fix ${d.code}: ${d.message}`, kind: "quickfix", diagnostics: [lspDiagnostic(d)], edit: { changes } },
    ];
  });
}
