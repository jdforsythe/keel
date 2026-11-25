// Support for the tests that run `keel ledger` over in-memory files through `run`: the files gain the run report of a
// run in which every test passed (`runReported`), so a rung rests on a run (k.ledger-items Run evidence). Not a test file.
import { run } from "../src/index.ts";
import type { Io } from "../src/types/Io.ts";
import { runReported } from "./runReported.ts";

/** `run(argv, io)`, with `io.files` given a passing run's reports when the command is `ledger`. */
export const ledgerRun = (argv: readonly string[], io: Io): ReturnType<typeof run> =>
  run(argv, argv[0] === "ledger" && io.files !== undefined ? { ...io, files: runReported(io.files) } : io);
