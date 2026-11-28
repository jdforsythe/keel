// k.evaluator End and Placing: how the command reads an evaluator's lines and its end. A result line that is no JSON,
// a line that is no JSON and a line past 64 MiB are E1049; every message that crosses loses its control characters;
// a `process.exit(13)` the code called is E1049, while Node's exit 13 for a top-level await that can never settle is
// E1048; a shell that refuses the processor-time limit still evaluates. Each entry writes on descriptor 3 itself, as a
// bootstrap that went wrong would. No generated input (seed not used).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, test } from "vitest";
import { EvaluateFailure } from "../src/EvaluateFailure.ts";
import { evaluate } from "../src/evaluate.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

/** An entry `entry.mjs` holding `source`, in a folder of its own. */
function entryOf(source: string): string {
  const dir = fs.realpathSync(tempDir(".tmp-evaluate-ends-", import.meta.dirname));
  dirs.push(dir);
  const file = path.join(dir, "entry.mjs");
  fs.writeFileSync(file, source);
  return file;
}

/** The failure `evaluate` of `source` resolves to; throws when it resolves to a result. */
async function failure(source: string, deadlineMs = 20_000): Promise<EvaluateFailure> {
  const r = await evaluate({ kind: "data", entry: entryOf(source), deadlineMs });
  if (!(r instanceof EvaluateFailure)) throw new Error(`a result: ${JSON.stringify(r)}`);
  return r;
}

/** A line written on descriptor 3 whatever the pipe answers, then a wait the command ends. */
const write3 = (text: string): string =>
  [
    "import fs from 'node:fs';",
    `const b = Buffer.from(${JSON.stringify(text)});`,
    "for (let o = 0; o < b.length; ) { try { o += fs.writeSync(3, b, o, b.length - o); } catch (e) { if (e.code !== 'EAGAIN') throw e; } }",
    "await new Promise((r) => setTimeout(r, 10_000));",
  ].join("\n");

describe("evaluate reads its evaluator's lines with care", () => {
  test(
    "a result whose json is no JSON is E1049, not a throw in the command",
    async () => {
      const f = await failure(write3(`${JSON.stringify({ t: "result", json: "{oops" })}\n`));
      expect(f.code).toBe("E1049");
      expect(f.message).toBe("entry.mjs: the entry's result is not JSON");
    },
    testTime(30_000),
  );

  test(
    "a line that is no JSON is E1049",
    async () => {
      const f = await failure(write3("not json\n"));
      expect(f.code).toBe("E1049");
      expect(f.message).toBe("entry.mjs: the evaluator sent a line that is not JSON");
    },
    testTime(30_000),
  );

  test(
    "a line past 64 MiB is E1049, and one of a few bytes under it is read",
    async () => {
      const big = [
        "import fs from 'node:fs';",
        "const b = Buffer.alloc(64 * 1024 * 1024 + 1, 97);",
        "for (let o = 0; o < b.length; ) { try { o += fs.writeSync(3, b, o, b.length - o); } catch (e) { if (e.code !== 'EAGAIN') throw e; } }",
        "await new Promise((r) => setTimeout(r, 10_000));",
      ].join("\n");
      const f = await failure(big);
      expect(f.code).toBe("E1049");
      expect(f.message).toBe("entry.mjs: the evaluator sent a line past 64 MiB");
      // A long line under the limit is parsed as any other: here an `at` naming a long file.
      const name = "a".repeat(1024 * 1024);
      const g = await failure(
        `${write3(`${JSON.stringify({ t: "at", file: name })}\n${JSON.stringify({ t: "failure", code: "E1234", message: "m" })}\n`)}`,
      );
      expect(g.code).toBe("E1234");
      expect(g.file).toBe(name);
    },
    testTime(60_000),
  );

  test(
    "every message that crosses back loses its control characters",
    async () => {
      const bell = String.fromCharCode(7);
      const esc = String.fromCharCode(27);
      const f = await failure(
        `throw Object.assign(new Error("bad${bell} ${esc}[31mred\\n\\tline${String.fromCharCode(0x9b)}"), { code: "E1234" });`,
      );
      expect(f.code).toBe("E1234");
      expect(f.message).toBe("bad [31mred line");
      const g = await failure(
        write3(
          `${JSON.stringify({ t: "at", file: `x${esc}.ts` })}\n${JSON.stringify({ t: "failure", code: "E1050", what: `w${bell}`, message: `m${esc}` })}\n`,
        ),
      );
      expect([g.file, g.what, g.message]).toEqual(["x.ts", "w", "m"]);
    },
    testTime(30_000),
  );
});

describe("evaluate reports how its evaluator ended", () => {
  test(
    "a process.exit(13) the code called is E1049 with its exit; Node's unsettled await is E1048",
    async () => {
      const exit = await failure("process.exit(13);");
      expect(exit.code).toBe("E1049");
      expect(exit.message).toBe("entry.mjs: the evaluator ended with exit 13");
      const stuck = await failure("await new Promise(() => {});");
      expect(stuck.code).toBe("E1048");
      expect(stuck.message).toBe("entry.mjs did not finish evaluating: a top-level await never settles");
    },
    testTime(30_000),
  );

  test.skipIf(process.platform === "win32")(
    "a shell that refuses the processor-time limit still starts the evaluation",
    () => {
      const entry = entryOf("export const n = 1;");
      // A hard limit of 30 s under the 61 s an evaluator of a 30 s deadline asks for: its `ulimit -t` fails.
      const out = execFileSync(
        "/bin/sh",
        [
          "-c",
          'ulimit -t 30; exec "$0" "$@"',
          process.execPath,
          path.join(import.meta.dirname, "evaluate-print-child.ts"),
          entry,
          "30000",
        ],
        { encoding: "utf8", timeout: testTime(20_000) },
      );
      expect(JSON.parse(out)).toEqual({ result: { n: 1 } });
    },
    testTime(30_000),
  );
});
