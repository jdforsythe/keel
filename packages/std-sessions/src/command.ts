import type { StdOperation } from "@keel/cli";
import { s } from "@keel/schema";
import { commandFetch } from "./internal/commandFetch.ts";
import { commandRun } from "./internal/commandRun.ts";
import { sessionDiag } from "./internal/sessionDiag.ts";

const OPS = ["capture", "ingest", "replay", "minimize", "to-test"] as const;

/**
 * The `session` command std.sessions fills with `stdCommand('session', command)` (k.cli, rfc:0070 §8):
 * `keel session capture [url] | ingest <url> [--failing] [--since t] | replay <f> | minimize <f> [--max-runs n] |
 * to-test <f>`. Positional fields `op`, `target`; the common flags. Records: `session` (one per session read or
 * written), `diag` (E2002-E2004 at the session file 1:1, E1056, I1055), and a `summary`.
 */
export const command: StdOperation = {
  name: "session",
  description: "Capture, ingest, replay, minimize, or turn into a test a recorded session (std.sessions).",
  input: s.object({
    op: s.enum(OPS),
    target: s.string().optional(),
    failing: s.boolean().optional(),
    since: s.string().optional(),
    "max-runs": s.int({ min: 1 }).optional(),
    format: s.enum(["compact", "json", "pretty"]).optional(),
    quiet: s.boolean().optional(),
    limit: s.int().optional(),
    verbose: s.boolean().optional(),
  }),
  output: s.object({ records: s.array(s.object({ kind: s.string() })) }),
  positional: ["op", "target"],
  scope: "query",
  run: async (input, io) => {
    const op = input.op;
    if (op === "capture" || op === "ingest") return commandFetch(op, input, io);
    if (op !== "replay" && op !== "minimize" && op !== "to-test") return { records: [], writes: [] };
    if (input.target === undefined) {
      const d = sessionDiag("E1052", `session ${op} needs a session file`);
      return { records: [d, { kind: "summary", ok: false, name: `session ${op}`, counts: {} }], writes: [] };
    }
    return commandRun(op, input.target, io, input["max-runs"]);
  },
};
