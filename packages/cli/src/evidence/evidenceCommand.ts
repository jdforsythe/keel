import type { Outcome } from "../internal/Outcome.ts";
import { bundleVerify } from "../internal/bundleVerify.ts";
import { bundleWrite } from "../internal/bundleWrite.ts";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";

/**
 * The `evidence` operation (k.evidence): `--verify <dir>` checks a bundle, otherwise one is written. It lives behind
 * `@keel/cli/evidence`, which the engine imports only when the command runs.
 */
export async function evidenceCommand(input: Input, io: Io): Promise<Outcome> {
  return input.verify === undefined ? bundleWrite(input, io) : bundleVerify(input, io);
}
