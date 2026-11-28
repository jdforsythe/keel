// Spec: k.evidence, clause "An `--audit` file that is not `pnpm audit --json` output is E1064; without `--audit`, `deps.json` has `advisories: null`."
// k.evidence, Rules "E1064 `--audit` file is not `pnpm audit --json` output"
// Seed: 1337. The audit input is a hand-written file in `pnpm audit --json` shape; nothing touches the network.
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  AUDIT_JSON,
  TEST_KEY_PEM,
  diagsOf,
  fixtureTree,
  keelEvidence,
  keyOf,
  parseJson,
  project,
  readTree,
  removeDir,
  scratch,
  writeBundle,
} from "./evidence-fixture.ts";

const SLOW = 300_000;
let dir = "";
let inputs = "";
const bases: string[] = [];

beforeAll(() => {
  dir = project(fixtureTree());
  inputs = scratch();
}, SLOW);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  removeDir(inputs);
  for (const b of bases) removeDir(b);
});

const advisoriesOf = (out: string): unknown => {
  const deps = parseJson(readTree(out).get("deps.json"));
  return typeof deps === "object" && deps !== null && "advisories" in deps ? deps.advisories : undefined;
};

describe("k.evidence: --audit and deps.json advisories", () => {
  test(
    "An `--audit` file that is not `pnpm audit --json` output is E1064",
    () => {
      const cases: [string, string][] = [
        ["not-json.txt", "this is not json\n"],
        ["wrong-shape.json", `${JSON.stringify({ hello: "world" })}\n`],
        ["array.json", "[1, 2, 3]\n"],
      ];
      for (const [name, text] of cases) {
        const file = join(inputs, name);
        writeFileSync(file, text);
        const { run, base } = writeBundle(dir, TEST_KEY_PEM, ["--audit", file]);
        bases.push(base);
        expect(run.status, name).toBe(1);
        expect(diagsOf(run, "E1064"), name).not.toEqual([]);
      }
    },
    SLOW,
  );

  test(
    "E1064 an `--audit` path that does not exist is not `pnpm audit --json` output",
    () => {
      const { run, base } = writeBundle(dir, TEST_KEY_PEM, ["--audit", join(inputs, "missing.json")]);
      bases.push(base);
      expect(run.status).toBe(1);
      expect(diagsOf(run, "E1064")).not.toEqual([]);
    },
    SLOW,
  );

  test(
    "a hand-written `pnpm audit --json` file is accepted and its advisory reaches `deps.json`",
    () => {
      const file = join(inputs, "audit.json");
      writeFileSync(file, AUDIT_JSON);
      const { out, base, run } = writeBundle(dir, TEST_KEY_PEM, ["--audit", file]);
      bases.push(base);
      expect(diagsOf(run, "E1064")).toEqual([]);
      const advisories = advisoriesOf(out);
      expect(advisories).not.toBeNull();
      expect(JSON.stringify(advisories)).toContain("1100001");
      expect(keelEvidence(dir, ["evidence", "--verify", out, "--key", keyOf(TEST_KEY_PEM).keyId]).status).toBe(0);
    },
    SLOW,
  );

  test(
    "without `--audit`, `deps.json` has `advisories: null`",
    () => {
      const { out, base } = writeBundle(dir, TEST_KEY_PEM);
      bases.push(base);
      expect(advisoriesOf(out)).toBeNull();
      const deps = parseJson(readTree(out).get("deps.json"));
      expect(deps).toHaveProperty("advisories");
    },
    SLOW,
  );
});
