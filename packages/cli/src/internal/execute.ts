import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { Operation } from "../types/Operation.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { checkCommand } from "./checkCommand.ts";
import { explainCommand } from "./explainCommand.ts";
import { ledgerCommand } from "./ledgerCommand.ts";
import { specCommand } from "./specCommand.ts";
import { testCommand } from "./testCommand.ts";
import { unavailable } from "./unavailable.ts";

/** Run one operation on schema-valid input. Every surface ends here: same input, same records. */
export async function execute(op: Operation, input: Input, io: Io): Promise<OutRecord[]> {
  switch (op.name) {
    case "check":
      return checkCommand(input, io);
    case "test":
      return testCommand();
    case "spec":
      return specCommand(input, io);
    case "explain":
      return explainCommand(input);
    case "ledger":
      return ledgerCommand(input, io);
    case "build":
    case "dev":
      return unavailable(op.name, "@keel/server", "k.server");
    case "inspect":
      return unavailable(op.name, "a running keel dev app", "k.server");
    case "render":
      return unavailable(op.name, "@keel/testing harness", "k.testing");
    case "scaffold":
    case "codemod":
      return unavailable(op.name, "@keel/scaffold", "k.scaffold");
  }
}
