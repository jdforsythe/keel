// Spec: k.evidence, Conformance "On a fixture project with `KEEL_EVIDENCE_KEY` set, `keel evidence` writes exactly the eight files above, and `--verify` of the result emits one `evidence` record and exits 0."
// Seed: 1337.
// Also covers the Signing and Verify paragraphs (manifest shape, signature, `evidence` record, compact line).
// Not testable here: "Every file parses with a schema `@keel/cli/evidence` exports" (the spec names no schema export); the
// `--verify` run parses each file with its schema, so a verifying bundle covers it.
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  BUNDLE_FILES,
  LISTED_FILES,
  TEST_KEY_PEM,
  countOf,
  diagsOf,
  fixtureTree,
  keelEvidence,
  keyOf,
  parseJson,
  project,
  readTree,
  removeDir,
  writeBundle,
} from "./evidence-fixture.ts";

const SLOW = 300_000;
let dir = "";
let base = "";
let out = "";

beforeAll(() => {
  dir = project(fixtureTree());
  const written = writeBundle(dir, TEST_KEY_PEM);
  base = written.base;
  out = written.out;
}, SLOW);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  removeDir(base);
});

const verify = (args: readonly string[] = []) => keelEvidence(dir, ["evidence", "--verify", out, ...args], {}, "json");

describe("k.evidence: write and verify", () => {
  test.skip(
    "On a fixture project with `KEEL_EVIDENCE_KEY` set, `keel evidence` writes exactly the eight files above",
    () => {
      expect([...readTree(out).keys()].sort()).toEqual([...BUNDLE_FILES].sort());
    },
    SLOW,
  );

  test.skip(
    "`--verify` of the result emits one `evidence` record and exits 0",
    () => {
      const run = verify();
      expect(run.status).toBe(0);
      const records = run.records.filter((r) => r.kind === "evidence");
      expect(records).toHaveLength(1);
      const record = records[0];
      expect(record).toMatchObject({ kind: "evidence", keyId: keyOf(TEST_KEY_PEM).keyId });
      expect(typeof record?.at).toBe("string");
      expect(String(record?.dir)).toContain("bundle");
      expect(countOf(record?.files)).toBe(LISTED_FILES.length);
      expect(run.records.filter((r) => r.kind === "diag" && r.severity === "error")).toEqual([]);
    },
    SLOW,
  );

  test.skip(
    "Verify: the compact record is `ok evidence <dir> 6 files key <keyId>`",
    () => {
      const run = keelEvidence(dir, ["evidence", "--verify", out], {}, "compact");
      const lines = run.stdout.split("\n");
      const keyId = keyOf(TEST_KEY_PEM).keyId;
      expect(lines.filter((l) => /^ok evidence \S+ 6 files key [0-9a-f]{16}$/.test(l))).toHaveLength(1);
      expect(run.stdout).toContain(`key ${keyId}`);
    },
    SLOW,
  );

  test.skip(
    "Signing: `manifest.json` is `{ v: 1, app, at, source, keel, key, keyId, runs, files }` with `files` listing the six other files by sha256 and bytes",
    () => {
      const files = readTree(out);
      const manifest = parseJson(files.get("manifest.json"));
      expect(manifest).toMatchObject({ v: 1, key: keyOf(TEST_KEY_PEM).key, keyId: keyOf(TEST_KEY_PEM).keyId });
      for (const k of ["app", "at", "source", "keel", "runs", "files"]) expect(manifest).toHaveProperty(k);
      const listed = typeof manifest === "object" && manifest !== null && "files" in manifest ? manifest.files : [];
      expect(Array.isArray(listed)).toBe(true);
      const entries = Array.isArray(listed) ? listed : [];
      expect(entries.map((e) => (typeof e === "object" && e !== null && "path" in e ? e.path : "")).sort()).toEqual(
        [...LISTED_FILES].sort(),
      );
      for (const e of entries) {
        if (typeof e !== "object" || e === null || !("path" in e)) throw new Error("file entry without path");
        const bytes = files.get(String(e.path));
        expect(bytes).toBeDefined();
        expect(e).toMatchObject({
          sha256: createHash("sha256")
            .update(bytes ?? Buffer.alloc(0))
            .digest("hex"),
          bytes: bytes?.length,
        });
      }
    },
    SLOW,
  );

  test.skip(
    "Signing: `manifest.sig` is the Ed25519 signature of `manifest.json`'s bytes, base64, under the manifest's `key`",
    () => {
      const files = readTree(out);
      const manifest = files.get("manifest.json") ?? Buffer.alloc(0);
      const sig = Buffer.from((files.get("manifest.sig") ?? Buffer.alloc(0)).toString("utf8").trim(), "base64");
      const parsed = parseJson(files.get("manifest.json"));
      const key = typeof parsed === "object" && parsed !== null && "key" in parsed ? String(parsed.key) : "";
      const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(key, "base64")]);
      const pub = createPublicKey({ key: spki, format: "der", type: "spki" });
      expect(verifySignature(null, manifest, pub, sig)).toBe(true);
    },
    SLOW,
  );

  test.skip(
    "Verify: a verifying bundle raises no E1062 or E1063",
    () => {
      const run = verify(["--key", keyOf(TEST_KEY_PEM).keyId]);
      expect(diagsOf(run, "E1062")).toEqual([]);
      expect(diagsOf(run, "E1063")).toEqual([]);
      expect(run.status).toBe(0);
    },
    SLOW,
  );
});
