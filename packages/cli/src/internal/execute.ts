import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { Operation } from "../types/Operation.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";
import type { Outcome } from "./Outcome.ts";
import { a11yRuleMap } from "./a11yRuleMap.ts";
import { buildCommand } from "./buildCommand.ts";
import { checkCommand } from "./checkCommand.ts";
import { explainCommand } from "./explainCommand.ts";
import { inspectCommand } from "./inspectCommand.ts";
import { ledgerCommand } from "./ledgerCommand.ts";
import { projectFiles } from "./projectFiles.ts";
import { scaffoldCommand } from "./scaffoldCommand.ts";
import { specCommand } from "./specCommand.ts";
import { stdSlot } from "./stdSlot.ts";
import { testCommand } from "./testCommand.ts";
import { unavailable } from "./unavailable.ts";

/** The a11y rule map, read only when a project has `.keel/routes.json` (k.a11y Claims items exist only then). */
const ledgerRules = (io: Io): A11yCriteriaMap =>
  projectFiles(io).some((f) => /(?:^|\/)\.keel\/routes\.json$/.test(f.path)) ? a11yRuleMap() : new Map();

const only = (records: readonly OutRecord[]): Outcome => ({
  records,
  writes: [],
});

/** Run one operation on schema-valid input. Every surface ends here: same input, same records and writes. */
export async function execute(op: Operation, input: Input, io: Io): Promise<Outcome> {
  switch (op.name) {
    case "check":
      return only(await checkCommand(input, io));
    case "test":
      return only(await testCommand(input, io));
    case "build":
      return await buildCommand(io, input);
    case "spec":
      return only(specCommand(input, io));
    case "explain":
      return only(explainCommand(input));
    case "ledger":
      return ledgerCommand(input, io, ledgerRules(io));
    case "evidence": {
      // Behind its own entry, loaded only when the command runs (`@keel/cli` size budget).
      const { evidenceCommand } = await import("@keel/cli/evidence");
      return evidenceCommand(input, io);
    }
    case "scaffold":
    case "codemod":
      return scaffoldCommand(op.name, input, io);
    case "dev":
      return only(unavailable(op.name, "vite.config.ts and the keel binary (vite dev server)", "k.server"));
    case "inspect":
      return only(await inspectCommand(input, io));
    case "session": {
      const std = stdSlot.op;
      return std === undefined
        ? only(unavailable(op.name, "the stdlib sessions module", "k.cli"))
        : await std.run(input, io);
    }
    case "render":
      return only(unavailable(op.name, "a compiled component or route loader", "k.testing"));
  }
}
