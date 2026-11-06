import { explain } from "@keel/check";
import type { Input } from "../types/Input.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { summary } from "./summary.ts";

/** Whole output, trailer included, stays within the 120-token explain budget (chars / 4). */
const BUDGET_CHARS = 480;

const lookup = (code: string): string => {
  try {
    return explain(code).trim();
  } catch {
    return "";
  }
};

/** `keel explain <code>`: delegates to `@keel/check` explain. No code: an empty result. Unknown code: E1052. */
export function explainCommand(input: Input): OutRecord[] {
  const code = input.code;
  if (code === undefined) return [summary("explain", [], { codes: 0 })];
  const text = lookup(code);
  if (text === "") {
    const d = makeDiag("E1052", `no explain entry for ${JSON.stringify(code.slice(0, 24))}`, { see: "k.check" });
    return [d, summary("explain", [d], {})];
  }
  const trailer = `ok explain ${code}\n`.length + 1;
  const room = BUDGET_CHARS - trailer;
  const clipped = text.length > room ? `${text.slice(0, room - 3)}...` : text;
  return [{ kind: "explain.text", code, text: clipped }, summary(`explain ${code}`, [], {})];
}
