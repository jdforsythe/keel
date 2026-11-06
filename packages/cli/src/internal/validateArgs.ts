import type { Operation } from "../types/Operation.ts";
import type { Validated } from "./Validated.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { isRecord } from "./isRecord.ts";
import { issueDiags } from "./issueDiags.ts";
import { makeDiag } from "./makeDiag.ts";

/** Validate structured arguments (MCP `tools/call`) with the same input schema the binary's flags use: E1052. */
export function validateArgs(op: Operation, args: unknown): Validated {
  const value = args ?? {};
  if (!isRecord(value))
    return { ok: false, diags: [makeDiag("E1052", "arguments must be an object", { see: "k.cli" })] };
  const fields = fieldsOf(op);
  const unknown = Object.keys(value).filter((k) => !fields.has(k));
  if (unknown.length > 0)
    return {
      ok: false,
      diags: unknown.map((k) =>
        makeDiag("E1052", `unknown argument ${JSON.stringify(k.slice(0, 24))}`, { see: "k.cli" }),
      ),
    };
  const parsed = op.input.parse(value);
  if (!parsed.ok)
    return {
      ok: false,
      diags: issueDiags(
        parsed.error,
        (f) => f,
        (f) => JSON.stringify(value[f]),
      ),
    };
  if (parsed.value.limit !== undefined && parsed.value.limit < 1)
    return {
      ok: false,
      diags: [makeDiag("E1052", `limit value ${parsed.value.limit} invalid (min)`, { see: "k.cli" })],
    };
  return { ok: true, input: parsed.value };
}
