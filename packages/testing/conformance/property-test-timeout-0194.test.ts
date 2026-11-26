import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
// @vitest-environment node
// Spec: k.testing, clause "Under `keelConfig`, a test whose one `properties` call names 100 runs and declares no timeout has 30 s; one that declares a timeout keeps it; a test with no `properties` or `simulate` call keeps the configured timeout."
// k.testing, Properties "Under `keelConfig` a test that calls `properties` or `simulate` and declares no timeout is given 300 ms per run its calls name, at least the configured test timeout; a call reached through a helper is not counted, and a call inside a loop counts once."
// Seed: 1337 (fc.sample below picks the run counts). Method: child `vitest run` under `keelConfig` over small fixture files; each fixture test appends its `task.timeout` to a file.
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SEED = 1337;
const run = promisify(execFile);
const pkg = join(import.meta.dirname, "..");
const vitestBin = join(pkg, "node_modules", ".bin", "vitest");
const base = mkdtempSync(join(pkg, ".tmp-timeout-"));
const out = join(mkdtempSync(join(tmpdir(), "keel-timeout-")), "t.tsv");
mkdirSync(base, { recursive: true });

const HEAD = `import { properties, simulate } from "@keel/testing";
import { appendFileSync } from "node:fs";
import { CartView } from "../../conformance/fixtures.ts";
import { test } from "vitest";
const viaHelper = () => properties(CartView, { runs: 100 });\nconst rec = (name, task) => appendFileSync(process.env.KEEL_TIMEOUT_OUT, name + "\\t" + task.timeout + "\\n");
`;

/** A fixture test: `name`, its body lines, and an optional trailing argument (a timeout or options). */
type Case = { name: string; body: string; extra?: string };
const source = (cases: readonly Case[]): string =>
  HEAD +
  cases
    .map((c) => {
      const fn = `async ({ task }) => { ${c.body}; rec(${JSON.stringify(c.name)}, task); }`;
      const name = JSON.stringify(c.name);
      return c.extra === undefined ? `test(${name}, ${fn});` : `test(${name}, ${c.extra}, ${fn});`;
    })
    .join("\n");

/** Runs the fixture cases in a child vitest under `keelConfig` with the given configured test timeout; name -> timeout. */
let n = 0;
async function timeouts(testTimeout: number, cases: readonly Case[]): Promise<Map<string, number>> {
  const dir = join(base, `d${n++}`);
  mkdirSync(dir);
  writeFileSync(join(dir, "a.test.ts"), source(cases));
  writeFileSync(
    join(dir, "vitest.config.ts"),
    `import { keelConfig } from "@keel/tooling/vitest-config";
export default keelConfig({ test: { include: ["*.test.ts"], environment: "happy-dom", testTimeout: ${testTimeout} } });
`,
  );
  rmSync(out, { force: true });
  writeFileSync(out, "");
  await run(vitestBin, ["run", "--config", join(dir, "vitest.config.ts"), "--root", dir], {
    cwd: pkg,
    // The clause states its numbers at scale 1 (300 ms per run, 30 s, the configured timeout): the child runs at scale 1
    // whatever scale this run has, so the values it records are the clause's own.
    env: { ...process.env, KEEL_TIMEOUT_OUT: out, KEEL_TEST_TIME_SCALE: "1" },
    timeout: testTime(120_000),
  }).catch((e: unknown) => {
    const text =
      typeof e === "object" && e !== null && "stdout" in e
        ? `${String(e.stdout)}${"stderr" in e ? String(e.stderr) : ""}`
        : String(e);
    throw new Error(`child vitest failed: ${text.slice(0, 3000)}`);
  });
  const m = new Map<string, number>();
  for (const line of readFileSync(out, "utf8").split("\n")) {
    const [name, ms] = line.split("\t");
    if (name !== undefined && ms !== undefined) m.set(name, Number(ms));
  }
  return m;
}

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
  rmSync(join(out, ".."), { recursive: true, force: true });
});

const counts = fc.sample(fc.integer({ min: 20, max: 120 }), { seed: SEED, numRuns: 6 });
const uniqueCounts = [...new Set(counts)];

describe("k.testing: a property or simulation test's time scales with its runs", () => {
  let low: Map<string, number>;
  let high: Map<string, number>;
  const lowCases: Case[] = [
    { name: "p100", body: "await properties(CartView, { runs: 100 })" },
    { name: "s100", body: "await simulate(async ({ run }) => { await run(); }, { runs: 100 })" },
    { name: "p100-declared", body: "await properties(CartView, { runs: 100 })", extra: "{ timeout: 1234 }" },
    { name: "p100-options", body: "await properties(CartView, { runs: 100 })", extra: "{ timeout: 2345 }" },
    {
      name: "s100-declared",
      body: "await simulate(async ({ run }) => { await run(); }, { runs: 100 })",
      extra: "{ timeout: 3456 }",
    },
    { name: "none", body: "" },
    { name: "helper", body: "await viaHelper()" },
    {
      name: "loop",
      body: "for (let i = 0; i < 3; i++) { await properties(CartView, { runs: 100 }); }",
    },
    {
      name: "two",
      body: "await properties(CartView, { runs: 100 }); await simulate(async ({ run }) => { await run(); }, { runs: 50 })",
    },
    { name: "tiny", body: "await properties(CartView, { runs: 1 })" },
    ...uniqueCounts.map((c) => ({ name: `p${c}`, body: `await properties(CartView, { runs: ${c} })` })),
  ];
  beforeAll(async () => {
    low = await timeouts(5000, lowCases);
    high = await timeouts(40_000, [
      { name: "p10", body: "await properties(CartView, { runs: 10 })" },
      { name: "p100", body: "await properties(CartView, { runs: 100 })" },
      { name: "none", body: "" },
    ]);
  }, 240_000);

  it("under `keelConfig`, a test whose one `properties` call names 100 runs and declares no timeout has 30 s", () => {
    expect(low.get("p100")).toBe(30_000);
  });

  it("a test whose `properties` call names `runs` has 300 ms per that number", () => {
    for (const c of uniqueCounts) expect(low.get(`p${c}`)).toBe(Math.max(300 * c, 5000));
  });

  it("a call naming `runs` never gives a test less than the configured test timeout", () => {
    expect(low.get("tiny")).toBe(5000);
    expect(high.get("p10")).toBe(40_000);
    expect(high.get("p100")).toBe(40_000);
  });

  it("a test that declares its own timeout keeps it", () => {
    expect(low.get("p100-declared")).toBe(1234);
    expect(low.get("p100-options")).toBe(2345);
  });

  it("a test with no `properties` or `simulate` call keeps the configured timeout", () => {
    expect(low.get("none")).toBe(5000);
    expect(high.get("none")).toBe(40_000);
  });

  it("a test whose `simulate` call names 100 runs and declares no timeout has 30 s", () => {
    expect(low.get("s100")).toBe(30_000);
  });

  it("a test that calls `simulate` and declares its own timeout keeps it", () => {
    expect(low.get("s100-declared")).toBe(3456);
  });

  it("a test's `properties` and `simulate` calls each add 300 ms per run they name", () => {
    expect(low.get("two")).toBe(300 * 150);
  });

  it("a call reached through a helper is not counted", () => {
    expect(low.get("helper")).toBe(5000);
  });

  it("a call inside a loop counts once", () => {
    expect(low.get("loop")).toBe(30_000);
  });
});
