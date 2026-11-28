import type { Input } from "../types/Input.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { summary } from "./summary.ts";

/** Whole output, trailer included, stays within the 120-token explain budget (chars / 4). */
const BUDGET_CHARS = 480;

/** A stdlib code (E2xxx, W2xxx, the spec map's code letters, k.docs): its rule registers when the project's std deps load. */
const STD_CODE = /^[EWI]2\d{3}$/;

/**
 * `keel explain <code>`: delegates to `@keel/check` explain. For a stdlib code it first runs `load` (the project's std
 * deps, so their registered rules explain their codes as `keel check` reports them; a project that cannot be read
 * explains kernel codes only). No code: an empty result. Unknown code: E1052. A text over the budget is cut in its
 * reason or example, never in its `see` line.
 */
export async function explainCommand(input: Input, load?: () => Promise<unknown>): Promise<OutRecord[]> {
  const code = input.code;
  if (code === undefined) return [summary("explain", [], { codes: 0 })];
  if (STD_CODE.test(code)) await load?.().catch(() => undefined);
  // The explanation table loads here, on the first lookup, and not when the binary starts.
  const text = await import("@keel/check/explain").then(
    (m) => m.explain(code).trim(),
    () => "",
  );
  if (text === "") {
    const d = makeDiag("E1052", `no explain entry for ${JSON.stringify(code.slice(0, 24))}`, { see: "k.check" });
    return [d, summary("explain", [d], {})];
  }
  const trailer = `ok explain ${code}\n`.length + 1;
  const room = BUDGET_CHARS - trailer;
  // Over the budget the reason and example lose text from their end; the `see` line is printed whole (k.explain).
  const at = text.lastIndexOf("\nsee: ");
  const see = at < 0 ? "" : text.slice(at);
  const body = at < 0 ? text : text.slice(0, at);
  const clipped = text.length > room ? `${body.slice(0, Math.max(0, room - see.length - 3))}...${see}` : text;
  return [{ kind: "explain.text", code, text: clipped }, summary(`explain ${code}`, [], {})];
}
