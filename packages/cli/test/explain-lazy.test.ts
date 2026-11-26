// The explanation table (`@keel/check/explain`) loads when `explain` runs and not for another command: the binary is
// run as a child process with a loader hook that appends every module URL it loads to a file.
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BIN = new URL("../src/bin.ts", import.meta.url).pathname;
const EXPLAIN_MODULE = "/packages/check/src/explain.ts";

let dir = "";
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "keel-explain-lazy-"));
  writeFileSync(
    join(dir, "hooks.mjs"),
    [
      'import { appendFileSync } from "node:fs";',
      "export async function load(url, context, next) {",
      "  appendFileSync(process.env.KEEL_LOAD_LOG, `${url}\\n`);",
      "  return next(url, context);",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(dir, "register.mjs"),
    `import { register } from "node:module";\nregister(${JSON.stringify(pathToFileURL(join(dir, "hooks.mjs")).href)});\n`,
  );
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

type Run = { stdout: string; loaded: string[] };
const keel = (args: string[], tag: string): Promise<Run> =>
  new Promise((resolve, reject) => {
    const log = join(dir, `${tag}.log`);
    writeFileSync(log, "");
    execFile(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", "--import", join(dir, "register.mjs"), BIN, ...args],
      { cwd: dir, env: { ...process.env, KEEL_AGENT: "1", KEEL_LOAD_LOG: log } },
      (err, stdout) => {
        if (err !== null && typeof err.code !== "number") reject(err);
        else resolve({ stdout, loaded: readFileSync(log, "utf8").split("\n") });
      },
    );
  });
const loadsExplain = (r: Run): boolean => r.loaded.some((u) => u.endsWith(EXPLAIN_MODULE));

describe("explanation table", () => {
  it(
    "is not loaded by a command other than explain",
    async () => {
      const r = await keel(["docs"], "docs");
      expect(r.loaded.some((u) => u.endsWith("/packages/cli/src/bin.ts"))).toBe(true);
      expect(loadsExplain(r)).toBe(false);
    },
    fixedTime(60_000),
  );

  it(
    "is loaded by keel explain, which prints the explanation",
    async () => {
      const r = await keel(["explain", "E1757"], "explain");
      expect(loadsExplain(r)).toBe(true);
      expect(r.stdout).toMatch(/^[^\n]+\n(?:[\s\S]*\n)?ok explain E1757\n$/);
      expect(r.stdout).toContain("E1757");
    },
    fixedTime(60_000),
  );
});
