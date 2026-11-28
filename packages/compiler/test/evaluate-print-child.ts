// Child process for evaluate-ends.test.ts (not a test file): evaluates the entry argv[2] with the deadline argv[3] and
// prints the result, or the failure's code and message, as one JSON line.
import { EvaluateFailure } from "../src/EvaluateFailure.ts";
import { evaluate } from "../src/evaluate.ts";

const entry = process.argv[2] ?? "";
const deadlineMs = Number(process.argv[3] ?? "30000");
const r = await evaluate({ kind: "data", entry, deadlineMs });
const out = r instanceof EvaluateFailure ? { code: r.code, message: r.message } : { result: r };
process.stdout.write(`${JSON.stringify(out)}\n`);
