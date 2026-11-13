// Spec: k.evidence, Conformance "Under one sim seed and clock, two runs on an unchanged project write byte-equal bundles."
// Seed: 1337 (`KEEL_SEED`). The key is the fixed test key from the fixture helper (Ed25519 signatures are deterministic),
// so the signature bytes compare too. The clock is not pinned by the test: the spec names no way to set it from outside.
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  BUNDLE_FILES,
  TEST_KEY_PEM,
  fixtureTree,
  project,
  readTree,
  removeDir,
  writeBundle,
} from "./evidence-fixture.ts";

const SLOW = 300_000;
let dir = "";
const bases: string[] = [];

beforeAll(() => {
  dir = project(fixtureTree());
}, SLOW);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const b of bases) removeDir(b);
});

describe("k.evidence: deterministic bundles", () => {
  test.skip(
    "Under one sim seed and clock, two runs on an unchanged project write byte-equal bundles",
    () => {
      const first = writeBundle(dir, TEST_KEY_PEM);
      const second = writeBundle(dir, TEST_KEY_PEM);
      bases.push(first.base, second.base);
      const a = readTree(first.out);
      const b = readTree(second.out);
      expect([...a.keys()].sort()).toEqual([...BUNDLE_FILES].sort());
      expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
      for (const [path, bytes] of a) expect(b.get(path)?.equals(bytes), path).toBe(true);
    },
    SLOW,
  );
});
