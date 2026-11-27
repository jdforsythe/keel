// Spec: k.explain, clause "In a project whose `package.json` has `packageManager` `npm@10.9.0`, every command the block names is `npx --no keel <command>` and its second line says to run a skill's `keel <command>` that way; with none, `pnpm keel <command>`."
// Seed: none (examples; each case spawns the real `keel`).
// ASSUMED (spec silent): "its second line" is the second non-empty line of the block after the start marker, headings (`#`) not counted; `keel <command>` written literally with `<` is a placeholder, not a command.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../..", import.meta.url));
const BIN = join(REPO, "packages/cli/src/bin.ts");
const START = "<!-- keel:start -->";
const END = "<!-- keel:end -->";

function keel(cwd: string, args: string[]): number | null {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("VITEST") && k !== "NODE_OPTIONS" && k !== "npm_config_user_agent") env[k] = v;
  }
  return spawnSync(process.execPath, [BIN, ...args, "--format=json"], { cwd, encoding: "utf8", env }).status;
}

let work = "";
let app = "";
beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "keel-agentpm-"));
  mkdirSync(join(work, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages")))
    symlinkSync(join(REPO, "packages", pkg), join(work, "node_modules/@keel", pkg));
  for (const n of ["vitest", "vite", "typescript", "happy-dom", "fast-check"])
    symlinkSync(join(REPO, "node_modules", n), join(work, "node_modules", n));
  if (keel(work, ["scaffold", "project", "shop"]) !== 0) throw new Error("scaffold project failed");
  app = join(work, "shop");
}, testTime(60_000));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const withManager = (pm: string | undefined): string => {
  const file = join(app, "package.json");
  const pkg: Record<string, unknown> = JSON.parse(readFileSync(file, "utf8"));
  if (pm === undefined) Reflect.deleteProperty(pkg, "packageManager");
  else pkg.packageManager = pm;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  const agents = join(app, "AGENTS.md");
  const text = readFileSync(agents, "utf8");
  writeFileSync(agents, text.replace(START, `${START}\nstray`));
  expect(keel(app, ["docs", "--sync"])).toBe(0);
  const back = readFileSync(agents, "utf8");
  return back.slice(back.indexOf(START) + START.length, back.indexOf(END));
};
const commandsOf = (block: string): string[] => [...block.matchAll(/\bkeel ([a-z][\w-]*)/g)].map((m) => m[0]);
const bare = (block: string): string[] =>
  [...block.matchAll(/\bkeel ([a-z][\w-]*)/g)]
    .filter((m) => !block.slice(0, m.index).endsWith("npx --no "))
    .map((m) => m[0]);

describe("k.explain Agent files, package manager", () => {
  it(
    "with `packageManager` `npm@10.9.0` every command the block names is `npx --no keel <command>` and its second line says so; with none, `pnpm keel <command>`",
    () => {
      const npm = withManager("npm@10.9.0");
      expect(commandsOf(npm).length).toBeGreaterThan(0);
      expect(bare(npm)).toEqual([]);
      const second = npm.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#"))[1] ?? "";
      expect(second).toContain("npx --no keel");
      const none = withManager(undefined);
      expect(commandsOf(none).length).toBeGreaterThan(0);
      for (const m of none.matchAll(/\bkeel ([a-z][\w-]*)/g))
        expect(none.slice(0, m.index).endsWith("pnpm "), m[0]).toBe(true);
      expect(none).not.toContain("npx --no keel");
    },
    testTime(120_000),
  );
});
