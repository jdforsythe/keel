import type { Input } from "../../types/Input.ts";
import type { Io } from "../../types/Io.ts";
import type { Outcome } from "../Outcome.ts";
import { makeDiag } from "../makeDiag.ts";
import { summary } from "../summary.ts";
import { tokensImportCommand } from "./tokensImportCommand.ts";
import { tokensSetCommand } from "./tokensSetCommand.ts";

/** `keel tokens import <file>...` and `keel tokens set <path> <value>` (k.cli Tokens); another operation is E1052. */
export async function tokensCommand(input: Input, io: Io): Promise<Outcome> {
  const { op } = input;
  if (op === "import") return tokensImportCommand(input, io);
  if (op === "set") return tokensSetCommand(input, io);
  const d = makeDiag(
    "E1052",
    op === undefined ? "tokens takes import or set" : `unknown tokens operation ${JSON.stringify(op.slice(0, 24))}`,
    { see: "k.cli" },
  );
  return { records: [d, summary("tokens", [d], {})], writes: [] };
}
