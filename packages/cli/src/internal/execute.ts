import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { Operation } from "../types/Operation.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";
import type { Outcome } from "./Outcome.ts";
import { explainCommand } from "./explainCommand.ts";
import { inspectCommand } from "./inspectCommand.ts";
import { loadStd } from "./loadStd.ts";
import { projectFiles } from "./projectFiles.ts";
import { stdSlot } from "./stdSlot.ts";
import { unavailable } from "./unavailable.ts";

/** The a11y rule map, read only when a project has `.keel/routes.json` (k.a11y Claims items exist only then). */
const ledgerRules = async (io: Io): Promise<A11yCriteriaMap> =>
  projectFiles(io).some((f) => /(?:^|\/)\.keel\/routes\.json$/.test(f.path))
    ? (await import("./a11yRuleMap.ts")).a11yRuleMap()
    : new Map();

const only = (records: readonly OutRecord[]): Outcome => ({
  records,
  writes: [],
});

/** Run one operation on schema-valid input. Every surface ends here: same input, same records and writes. */
export async function execute(op: Operation, input: Input, io: Io): Promise<Outcome> {
  switch (op.name) {
    case "check": {
      // Loaded only when the command runs: it brings in typescript and the checker.
      const { checkCommand } = await import("./checkCommand.ts");
      return only(await checkCommand(input, io));
    }
    case "test": {
      // Loaded only when the command runs: it brings in vitest and the test harness.
      const { testCommand } = await import("./testCommand.ts");
      return only(await testCommand(input, io));
    }
    case "build": {
      // Loaded only when the command runs: it brings in the compiler, the checker and typescript.
      const { buildCommand } = await import("./buildCommand.ts");
      return await buildCommand(io, input);
    }
    case "docs": {
      // Behind its own entry, loaded only when the command runs (`@keel/cli` size budget).
      const { docsCommand } = await import("@keel/cli/docs");
      return docsCommand(input, io);
    }
    case "explain":
      // `explain` reads no files; a stdlib code loads the project's manifests to register its std deps' rules.
      return only(await explainCommand(input, () => loadStd(io.load === undefined ? io : { ...io, files: undefined })));
    case "ledger": {
      // Loaded only when the command runs: it brings in typescript and the test harness.
      const { ledgerCommand } = await import("./ledgerCommand.ts");
      const map = await ledgerRules(io);
      // The static a11y codes, with each project's `tokens.ts` evaluated (k.a11y-static Tokens).
      const findings =
        map.size === 0 ? [] : await (await import("./a11yFindings.ts")).a11yFindings(io.cwd, projectFiles(io));
      return ledgerCommand(input, io, map, findings);
    }
    case "evidence": {
      // Behind its own entry, loaded only when the command runs (`@keel/cli` size budget).
      const { evidenceCommand } = await import("@keel/cli/evidence");
      return evidenceCommand(input, io);
    }
    case "review": {
      // Behind its own entry, loaded only when the command runs (`@keel/cli` size budget).
      const { reviewCommand } = await import("@keel/cli/review");
      return reviewCommand(input, io);
    }
    case "scaffold":
    case "codemod": {
      // Loaded only when the command runs: it brings in the scaffolder, the compiler and the checker.
      const { scaffoldCommand } = await import("./scaffoldCommand.ts");
      return await scaffoldCommand(op.name, input, io);
    }
    case "dev":
      return only(unavailable(op.name, "vite.config.ts and the keel binary (vite dev server)", "k.server"));
    case "inspect":
      return only(await inspectCommand(input, io));
    case "render":
      return only(unavailable(op.name, "a compiled component or route loader", "k.testing"));
  }
  // `session` and `report`: the operation a stdlib package filled into the slot (`stdCommand`).
  const std = stdSlot.get(op.name);
  return std === undefined ? only(unavailable(op.name, `the stdlib ${op.name} module`, "k.cli")) : std.run(input, io);
}
