// Child process for host-views.test.ts (not a test file): runs argv[3], JavaScript that sets `result`, after the
// evaluation bundle's head (`OBSERVE_BANNER`) as one module in the folder argv[2], in an evaluator (`evaluate`), and
// prints `{ result, probes, leaked }`: the probes the command recorded, and `leaked`, what reached this process's
// global object and `process.env`.
import fs from "node:fs";
import path from "node:path";
import { EvaluateFailure } from "../src/EvaluateFailure.ts";
import { evaluate } from "../src/evaluate.ts";
import { OBSERVE_BANNER } from "../src/internal/OBSERVE_BANNER.ts";
import { UNRESOLVED_MARK } from "../src/internal/UNRESOLVED_MARK.ts";
import { evaluatorAnswers } from "../src/internal/evaluatorAnswers.ts";

const dir = path.join(process.argv[2] ?? "", "bundle");
const code = process.argv[3] ?? "";
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "evaluate.mjs");
fs.writeFileSync(file, `${OBSERVE_BANNER.replace(UNRESOLVED_MARK, "[]")}\nlet result;\n${code}\nexport { result };\n`);
const asked = evaluatorAnswers();
const out = await evaluate({ kind: "data", entry: file, answer: asked.answer });
if (out instanceof EvaluateFailure) throw new Error(`${out.code} ${out.message}`);
const leaked = [
  ...(Reflect.has(globalThis, "keelMark") ? ["globalThis.keelMark"] : []),
  ...Object.keys(process.env).filter((k) => k.startsWith("KEEL_MARK")),
];
process.stdout.write(`${JSON.stringify({ result: out.result, probes: asked.observed().probes, leaked })}\n`);
