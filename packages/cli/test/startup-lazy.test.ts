// The binary's start does not load the heavy dependencies: typescript, axe-core, vitest and the checker and compiler
// that bring typescript in load behind the commands that use them. The binary is run as a child process with a loader
// hook that appends every module URL it loads to a file.
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BIN = new URL("../src/bin.ts", import.meta.url).pathname;
const HEAVY = [
  "/node_modules/typescript/",
  "/node_modules/axe-core/",
  "/node_modules/vitest/",
  "/packages/check/src/",
  "/packages/compiler/src/",
];

let dir = "";
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "keel-startup-lazy-"));
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

const loadedBy = (args: string[], tag: string): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const log = join(dir, `${tag}.log`);
    writeFileSync(log, "");
    execFile(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", "--import", join(dir, "register.mjs"), BIN, ...args],
      { cwd: dir, env: { ...process.env, KEEL_AGENT: "1", KEEL_LOAD_LOG: log } },
      (err) => {
        if (err !== null && typeof err.code !== "number") reject(err);
        else resolve(readFileSync(log, "utf8").split("\n"));
      },
    );
  });
const heavy = (loaded: string[]): string[] => HEAVY.filter((h) => loaded.some((u) => u.includes(h)));

describe("binary start", () => {
  it.each([
    ["no command", []],
    ["an unknown command", ["bogus"]],
    ["an unknown flag", ["docs", "--bogus"]],
    ["docs", ["docs"]],
    ["review", ["review", "--list"]],
  ])(
    "loads no heavy dependency for %s",
    async (name, args) => {
      const loaded = await loadedBy(args, name.replace(/\s/g, "-"));
      expect(loaded.some((u) => u.endsWith("/packages/cli/src/bin.ts"))).toBe(true);
      expect(heavy(loaded)).toEqual([]);
    },
    60_000,
  );

  it(
    "loads typescript and the checker for check",
    async () => {
      const loaded = await loadedBy(["check"], "check");
      expect(heavy(loaded)).toEqual(expect.arrayContaining(["/node_modules/typescript/", "/packages/check/src/"]));
    },
    fixedTime(60_000),
  );
});
