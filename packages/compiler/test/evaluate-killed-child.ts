// Child process for evaluate-killed.test.ts (not a test file): evaluates the entry argv[2] with the deadline argv[3]
// and prints `started` once the evaluator runs; the test kills this process with SIGKILL mid-evaluation.
import { evaluate } from "../src/evaluate.ts";

const entry = process.argv[2] ?? "";
const deadlineMs = Number(process.argv[3] ?? "30000");
process.stdout.write("started\n");
await evaluate({ kind: "data", entry, deadlineMs });
