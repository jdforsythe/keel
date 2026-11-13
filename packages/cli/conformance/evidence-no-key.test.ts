// Spec: k.evidence, Conformance "Without `KEEL_EVIDENCE_KEY`, or with an RSA key, the command writes nothing and reports E1061."
// Spec: k.evidence, Rules "E1061 `KEEL_EVIDENCE_KEY` absent or not Ed25519; nothing is written"
// Seed: 1337. "Writes nothing": the `--out` directory does not exist and the project tree is unchanged.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  diagsOf,
  fixtureTree,
  keelEvidence,
  newKeyPem,
  project,
  readTree,
  removeDir,
  scratch,
} from "./evidence-fixture.ts";

const SLOW = 300_000;
let dir = "";
let base = "";

beforeAll(() => {
  dir = project(fixtureTree());
  base = scratch();
}, SLOW);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  removeDir(base);
});

/** The project's own files, less what `check`, `test` and `ledger` may leave (reports, artifacts, caches). */
const sources = (): string[] =>
  [...readTree(dir).keys()].filter(
    (p) => !p.startsWith("node_modules/") && !p.startsWith(".keel/") && !p.startsWith("reports/"),
  );

const attempt = (name: string, env: Record<string, string>) => {
  const out = join(base, name);
  const before = sources();
  const run = keelEvidence(dir, ["evidence", "--out", out], env);
  return { run, out, before, after: sources() };
};

describe("k.evidence: E1061 without a usable key", () => {
  test(
    "Without `KEEL_EVIDENCE_KEY`, the command writes nothing and reports E1061",
    () => {
      const { run, out, before, after } = attempt("absent", {});
      expect(run.status).toBe(1);
      expect(diagsOf(run, "E1061")).not.toEqual([]);
      expect(readTree(out).size).toBe(0);
      expect(after).toEqual(before);
    },
    SLOW,
  );

  test(
    "With an RSA key, the command writes nothing and reports E1061",
    () => {
      const { run, out, before, after } = attempt("rsa", { KEEL_EVIDENCE_KEY: newKeyPem("rsa") });
      expect(run.status).toBe(1);
      expect(diagsOf(run, "E1061")).not.toEqual([]);
      expect(readTree(out).size).toBe(0);
      expect(after).toEqual(before);
    },
    SLOW,
  );

  test(
    "E1061 a value that is not a PEM private key at all writes nothing and reports E1061",
    () => {
      const { run, out } = attempt("garbage", { KEEL_EVIDENCE_KEY: "not a key" });
      expect(run.status).toBe(1);
      expect(diagsOf(run, "E1061")).not.toEqual([]);
      expect(readTree(out).size).toBe(0);
    },
    SLOW,
  );
});
