// Spec: k.check, clause "Compact output for golden app 1 with 10 injected errors is at most 600 tokens."
// Runs the real binary the way the budget tool does. Token estimate: ceil(chars / 4). No generated inputs; seed 1337 n/a.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const SKIP = new Set(["node_modules", "dist", ".turbo", ".keel"]);
const CODES = ["E1401", "E1403", "E1451", "E1452", "E1601", "E1701", "E1751", "E1752", "E1802", "E1805"];

let stdout = "";
let status: number | null = null;

beforeAll(() => {
  const tmp = mkdtempSync(join(root, "apps", ".injected10-conf-"));
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
    rmSync(tmp, { recursive: true, force: true });
  }
}, 180_000);

describe("k.check injected-10 budget", () => {
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
}, 180_000);
