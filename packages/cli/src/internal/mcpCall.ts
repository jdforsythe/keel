import { operations } from "../operations.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { codeFilter } from "./codeFilter.ts";
import { execute } from "./execute.ts";
import { isRecord } from "./isRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { respond } from "./respond.ts";
import { usageResult } from "./usageResult.ts";
import { validateArgs } from "./validateArgs.ts";

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent: { records: readonly OutRecord[] };
  isError: boolean;
};

const result = (r: { code: number; stdout: string; records: readonly OutRecord[] }): ToolResult => ({
  content: [{ type: "text", text: r.stdout }],
  structuredContent: { records: r.records },
  isError: r.code !== 0,
});

/**
 * MCP `tools/call`: validate arguments with the operation's input schema, execute, render. Agents are the client,
 * so the default format is compact (not a TTY); `structuredContent.records` carries the same records as json.
 */
export async function mcpCall(params: unknown, io: Io): Promise<ToolResult> {
  const p = isRecord(params) ? params : {};
  const name = typeof p.name === "string" ? p.name : "";
  const agent: Io = { ...io, tty: false };
  const op = operations.find((o) => o.name === name);
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
  const records = await execute(op, v.input, agent);
  return result(respond(records, agent, { ...v.input, command: op.name, code: codeFilter(op, v.input) }));
}
