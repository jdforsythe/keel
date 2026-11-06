import type { LspState } from "./LspState.ts";
import { explainCommand } from "./explainCommand.ts";
import { isRecord } from "./isRecord.ts";

/** `textDocument/hover`: `explain` for the diagnostic on the hovered line, else null. */
export function lspHover(state: LspState, params: unknown): Record<string, unknown> | null {
  const p = isRecord(params) ? params : {};
  const doc = isRecord(p.textDocument) ? p.textDocument : {};
  const pos = isRecord(p.position) ? p.position : {};
  const uri = typeof doc.uri === "string" ? doc.uri : "";
  const line = typeof pos.line === "number" ? pos.line : -1;
  const hit = (state.diags.get(uri) ?? []).find((d) => (d.line ?? 1) - 1 === line);
  if (hit === undefined) return null;
  const rec = explainCommand({ code: hit.code }).find((r) => r.kind === "explain.text");
  const text = typeof rec?.text === "string" ? rec.text : hit.message;
  return { contents: { kind: "markdown", value: text } };
}
