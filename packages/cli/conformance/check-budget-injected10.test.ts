// Spec: k.check, clause "Compact output for golden app 1 with 10 injected errors is at most 600 tokens."
// Runs the real binary the way the budget tool does. Token estimate: ceil(chars / 4). No generated inputs; seed 1337 n/a.
import { fixedTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const SKIP = new Set(["node_modules", "dist", ".turbo", ".keel"]);
const CODES = ["E1401", "E1403", "E1451", "E1452", "E1601", "E1701", "E1751", "E1752", "E1802", "E1805"];

let stdout = "";
let status: number | null = null;
let tmp = "";

// The copy lives under the git-ignored top-level .fixtures/, which no pnpm-workspace glob matches, so an interrupted run cannot leave a duplicate
// workspace member (backlog 0204). It stays inside the repo so TypeScript still finds the root node_modules/@types (os.tmpdir() does not).
const cleanup = (): void => {
  if (tmp !== "") rmSync(tmp, { recursive: true, force: true });
};

beforeAll(() => {
  // Defensive: remove stale copies left in apps/ by earlier versions of this test.
  for (const d of readdirSync(join(root, "apps"))) {
    if (d.startsWith(".injected10-")) rmSync(join(root, "apps", d), { recursive: true, force: true });
  }
  mkdirSync(join(root, ".fixtures"), { recursive: true });
  for (const d of readdirSync(join(root, ".fixtures"))) {
    if (d.startsWith("injected10-conf-")) rmSync(join(root, ".fixtures", d), { recursive: true, force: true });
  }
  tmp = mkdtempSync(join(root, ".fixtures", "injected10-conf-"));
  process.on("exit", cleanup);
  try {
    cpSync(join(root, "apps", "golden-1"), tmp, { recursive: true, filter: (src) => !SKIP.has(basename(src)) });
    cpSync(join(root, "tooling", "fixtures", "injected10-app"), tmp, { recursive: true });
    const nm = join(root, "apps", "golden-1", "node_modules");
    if (!existsSync(nm)) throw new Error("apps/golden-1/node_modules is missing; run pnpm install");
    symlinkSync(nm, join(tmp, "node_modules"));
    const r = spawnSync(
      process.execPath,
      [join(root, "packages", "cli", "src", "bin.ts"), "check", "--format=compact"],
      {
        cwd: tmp,
        encoding: "utf8",
        env: { ...process.env, KEEL_AGENT: "1" },
      },
    );
    stdout = r.stdout;
    status = r.status;
  } finally {
    cleanup();
  }
}, fixedTime(180_000));

afterAll(cleanup);

describe(
  "k.check injected-10 budget",
  () => {
    it("Compact output for golden app 1 with 10 injected errors is at most 600 tokens", () => {
      expect(status).toBe(1);
      expect(Math.ceil(stdout.length / 4)).toBeLessThanOrEqual(600);
    });

    it("the compact output names each of the ten injected codes", () => {
      for (const c of CODES) expect(stdout).toContain(c);
    });

    it("the compact output has no ANSI escapes and its last line reports 10 errors", () => {
      expect(stdout).not.toContain(String.fromCharCode(27));
      const last =
        stdout
          .split("\n")
          .filter((l) => l.length > 0)
          .at(-1) ?? "";
      expect(last).toMatch(/\b10 errors?\b/);
    });
  },
  fixedTime(180_000),
);
