import { s } from "@keel/schema";
import type { Input, OutRecord, StdOperation } from "../src/index.ts";

/** A `session` operation that echoes its parsed positional input as an `I9999`-free info diag plus a summary. */
export const makeOp = (tag: string, seen: Input[] = []): StdOperation => ({
  name: "session",
  description: `session ${tag}`,
  input: s.object({
    op: s.string().optional(),
    target: s.string().optional(),
    format: s.enum(["compact", "json", "pretty"]).optional(),
    quiet: s.boolean().optional(),
    limit: s.int().optional(),
  }),
  output: s.object({ records: s.array(s.object({ kind: s.string() })) }),
  positional: ["op", "target"],
  scope: "none",
  run: async (input) => {
    seen.push(input);
    const records: OutRecord[] = [
      { kind: "summary", ok: true, name: `session ${input.op ?? ""} ${input.target ?? ""}`.trim(), counts: {} },
    ];
    return { records, writes: [] };
  },
});
