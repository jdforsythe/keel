// Spec: k.evidence, Conformance "Changing a byte of any bundle file, adding a file or removing one makes `--verify` report E1062 naming it; a manifest signed by another key, a `--key` naming another keyId, or no `--key`, is E1063."
// Spec: k.evidence, Rules "E1062 a listed file missing, changed or not parsing with its schema, or an unlisted file present (names it)"
// Spec: k.evidence, Rules "E1063 `--key` absent, the key's id or `keyId` not `--key`, or signature invalid"
// Seed: 1337. The byte flips are a property (file, position, mask); each run spawns `keel evidence --verify`, so 20 runs.
// The clause says "any bundle file", but `manifest.json` and `manifest.sig` are not listed in `files`, so for them the
// test accepts E1062 or E1063 (the spec does not say which); the six listed files must be E1062.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  LISTED_FILES,
  SEED,
  TEST_KEY_PEM,
  copyBundle,
  diagsOf,
  fixtureTree,
  keelEvidence,
  keyOf,
  newKeyPem,
  project,
  removeDir,
  signWith,
  writeBundle,
} from "./evidence-fixture.ts";

const SLOW = 300_000;
let dir = "";
let base = "";
let original = "";
let work = "";

beforeAll(() => {
  dir = project(fixtureTree());
  const written = writeBundle(dir, TEST_KEY_PEM);
  base = written.base;
  original = written.out;
  work = copyBundle(original);
}, SLOW);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  removeDir(base);
  removeDir(work);
});

const verify = (target: string, args: readonly string[] = ["--key", keyOf(TEST_KEY_PEM).keyId]) =>
  keelEvidence(dir, ["evidence", "--verify", target, ...args]);
const names = (run: ReturnType<typeof verify>, code: string, file: string): boolean =>
  diagsOf(run, code).some((d) => JSON.stringify(d).includes(file));

describe("k.evidence: tampering and signatures", () => {
  test(
    "the untouched bundle verifies, so each failure below comes from the change made",
    () => {
      expect(verify(work).status).toBe(0);
    },
    SLOW,
  );

  test(
    "Changing a byte of any listed bundle file makes `--verify` report E1062 naming it",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...LISTED_FILES),
          fc.nat(),
          fc.integer({ min: 1, max: 255 }),
          async (file, at, mask) => {
            const path = join(work, file);
            const bytes = readFileSync(path);
            const changed = Buffer.from(bytes);
            const i = at % Math.max(bytes.length, 1);
            changed[i] = (changed[i] ?? 0) ^ mask;
            writeFileSync(path, changed);
            try {
              const run = verify(work);
              expect(run.status).toBe(1);
              expect(names(run, "E1062", file)).toBe(true);
            } finally {
              writeFileSync(path, bytes);
            }
          },
        ),
        { seed: SEED, numRuns: 20 },
      );
    },
    SLOW,
  );

  test(
    "Changing a byte of `manifest.json` or `manifest.sig` makes `--verify` fail with E1062 or E1063",
    () => {
      for (const file of ["manifest.json", "manifest.sig"]) {
        const path = join(work, file);
        const bytes = readFileSync(path);
        const changed = Buffer.from(bytes);
        changed[Math.floor(bytes.length / 2)] = (changed[Math.floor(bytes.length / 2)] ?? 0) ^ 1;
        writeFileSync(path, changed);
        try {
          const run = verify(work);
          expect(run.status).toBe(1);
          expect(diagsOf(run, "E1062").length + diagsOf(run, "E1063").length).toBeGreaterThan(0);
        } finally {
          writeFileSync(path, bytes);
        }
      }
    },
    SLOW,
  );

  test(
    "adding a file makes `--verify` report E1062 naming it",
    () => {
      const extra = join(work, "extra.txt");
      writeFileSync(extra, "not listed\n");
      try {
        const run = verify(work);
        expect(run.status).toBe(1);
        expect(names(run, "E1062", "extra.txt")).toBe(true);
      } finally {
        rmSync(extra, { force: true });
      }
    },
    SLOW,
  );

  test(
    "removing a listed file makes `--verify` report E1062 naming it",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...LISTED_FILES), async (file) => {
          const path = join(work, file);
          const bytes = readFileSync(path);
          rmSync(path);
          try {
            const run = verify(work);
            expect(run.status).toBe(1);
            expect(names(run, "E1062", file)).toBe(true);
          } finally {
            writeFileSync(path, bytes);
          }
        }),
        { seed: SEED, numRuns: LISTED_FILES.length },
      );
    },
    SLOW,
  );

  test(
    "a manifest signed by another key is E1063",
    () => {
      const sigPath = join(work, "manifest.sig");
      const sig = readFileSync(sigPath);
      const manifest = readFileSync(join(work, "manifest.json"));
      writeFileSync(sigPath, signWith(newKeyPem("ed25519"), manifest));
      try {
        const run = verify(work);
        expect(run.status).toBe(1);
        expect(diagsOf(run, "E1063")).not.toEqual([]);
        expect(diagsOf(run, "E1062")).toEqual([]);
      } finally {
        writeFileSync(sigPath, sig);
      }
    },
    SLOW,
  );

  test(
    "a `--key` naming another keyId is E1063, and the bundle's own keyId passes",
    () => {
      const own = keyOf(TEST_KEY_PEM).keyId;
      const other = keyOf(newKeyPem("ed25519")).keyId;
      expect(other).not.toBe(own);
      const wrong = verify(work, ["--key", other]);
      expect(wrong.status).toBe(1);
      expect(diagsOf(wrong, "E1063")).not.toEqual([]);
      expect(verify(work, ["--key", own]).status).toBe(0);
    },
    SLOW,
  );
});
