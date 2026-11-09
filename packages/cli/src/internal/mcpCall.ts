import { operations } from "../operations.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { isRecord } from "./isRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { perform } from "./perform.ts";
import { stdSlot } from "./stdSlot.ts";
import { usageResult } from "./usageResult.ts";
import { validateArgs } from "./validateArgs.ts";

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent: { records: readonly OutRecord[] };
  isError: boolean;
};

const result = (r: {
  code: number;
  stdout: string;
  records: readonly OutRecord[];
}): ToolResult => ({
  content: [{ type: "text", text: r.stdout }],
  structuredContent: { records: r.records },
  isError: r.code !== 0,
});

/**
 * MCP `tools/call`: validate arguments with the operation's input schema, execute, render. Agents are the client,
 * so the default format is compact (not a TTY); `structuredContent.records` carries the same records as json.
 * Same `perform` as the binary: file scope from the operation, effects of a successful call to `io.apply`.
 */
export async function mcpCall(params: unknown, io: Io): Promise<ToolResult> {
  const p = isRecord(params) ? params : {};
  const name = typeof p.name === "string" ? p.name : "";
  const agent: Io = { ...io, tty: false };
  const op = [...operations, ...(stdSlot.op === undefined ? [] : [stdSlot.op])].find((o) => o.name === name);
  if (op === undefined)
    return result(
      usageResult(
        name,
        [makeDiag("E1051", `unknown command ${JSON.stringify(name.slice(0, 24))}`, { see: "k.cli" })],
        agent,
        undefined,
      ),
    );
  const v = validateArgs(op, p.arguments);
  if (!v.ok) return result(usageResult(name, v.diags, agent, undefined));
  const e = await perform(op, v.input, agent);
  return result({ ...e.result, records: e.records });
}
