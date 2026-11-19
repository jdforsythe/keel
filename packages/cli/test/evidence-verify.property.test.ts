// k.evidence Verify: a bundle's verification fails for every single-byte change of any of its files. Seed 1337.
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { bundleVerify } from "../src/internal/bundleVerify.ts";
import { keyIdOf } from "../src/internal/keyIdOf.ts";
import { sha256Hex } from "../src/internal/sha256Hex.ts";

const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;
const REPORTS: Record<string, string> = {
  "a11y.json": json({ v: 1, claims: [], person: [], contrast: [] }),
  "check.ndjson": `${JSON.stringify({ kind: "summary", ok: true, name: "check", counts: { files: 1 } })}\n`,
  "deps.json": json({ bomFormat: "CycloneDX", specVersion: "1.5", components: [], advisories: null }),
  "ledger.ndjson": `${JSON.stringify({ kind: "ledger", item: "k.cli#1", rung: "example", evidence: "example t.ts" })}\n`,
  "pii.json": json({ v: 1, paths: [], sinks: [], coverage: 1, unread: [] }),
  "security.json": json({ v: 1, deployables: [] }),
};

const dir = mkdtempSync(join(tmpdir(), "keel-evidence-prop-"));
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const raw = publicKey.export({ format: "der", type: "spki" }).subarray(12);
const manifest = json({
  v: 1,
  app: "fx",
  at: "1970-01-01T00:00:00.000Z",
  source: null,
  keel: {},
  key: raw.toString("base64"),
  keyId: keyIdOf(raw),
  runs: { checkErrors: 0, failedTests: 0 },
  files: Object.entries(REPORTS).map(([path, text]) => ({
    path,
    sha256: sha256Hex(Buffer.from(text)),
    bytes: Buffer.byteLength(text),
  })),
});
for (const [path, text] of Object.entries(REPORTS)) writeFileSync(join(dir, path), text);
writeFileSync(join(dir, "manifest.json"), manifest);
writeFileSync(join(dir, "manifest.sig"), `${sign(null, Buffer.from(manifest), privateKey).toString("base64")}\n`);
const FILES = readdirSync(dir).sort();
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const KEY_ID = keyIdOf(raw);
const verify = (key: string | null = KEY_ID) =>
  bundleVerify(key === null ? { verify: dir } : { verify: dir, key }, { cwd: dir });
const codes = (o: ReturnType<typeof verify>): string[] =>
  o.records.flatMap((r) => (r.kind === "diag" && typeof r.code === "string" ? [r.code] : []));

describe("keel evidence --verify", () => {
  it("passes the untouched bundle with one evidence record of six files", () => {
    expect(FILES).toHaveLength(8);
    expect(verify().records).toEqual([expect.objectContaining({ kind: "evidence", files: 6 })]);
  });

  it("is E1063 without --key, and for files edited and re-signed with another key", () => {
    expect(codes(verify(null))).toEqual(["E1063"]);
    const keep = new Map(FILES.map((f) => [f, readFileSync(join(dir, f))]));
    try {
      const other = generateKeyPairSync("ed25519");
      const otherRaw = other.publicKey.export({ format: "der", type: "spki" }).subarray(12);
      const text = json({ v: 1, deployables: [{ adapter: "client", name: "w", csp: "default-src *" }] });
      writeFileSync(join(dir, "security.json"), text);
      const forged = manifest
        .replace(raw.toString("base64"), otherRaw.toString("base64"))
        .replace(KEY_ID, keyIdOf(otherRaw))
        .replace(sha256Hex(Buffer.from(REPORTS["security.json"] ?? "")), sha256Hex(Buffer.from(text)))
        .replace(
          `"bytes": ${Buffer.byteLength(REPORTS["security.json"] ?? "")}`,
          `"bytes": ${Buffer.byteLength(text)}`,
        );
      writeFileSync(join(dir, "manifest.json"), forged);
      writeFileSync(
        join(dir, "manifest.sig"),
        `${sign(null, Buffer.from(forged), other.privateKey).toString("base64")}\n`,
      );
      expect(codes(verify())).toEqual(["E1063"]);
      expect(codes(verify(keyIdOf(otherRaw)))).toEqual([]);
    } finally {
      for (const [f, b] of keep) writeFileSync(join(dir, f), b);
    }
  });

  it("fails with E1062 or E1063 for every single-byte change of any file", () => {
    fc.assert(
      fc.property(fc.constantFrom(...FILES), fc.nat(), fc.integer({ min: 1, max: 255 }), (file, at, mask) => {
        const path = join(dir, file);
        const bytes = readFileSync(path);
        const changed = Buffer.from(bytes);
        const i = at % bytes.length;
        changed[i] = (changed[i] ?? 0) ^ mask;
        writeFileSync(path, changed);
        try {
          const found = codes(verify());
          expect(found.length).toBeGreaterThan(0);
          expect(found.every((c) => c === "E1062" || c === "E1063")).toBe(true);
          if (file !== "manifest.json" && file !== "manifest.sig") expect(found).toContain("E1062");
        } finally {
          writeFileSync(path, bytes);
        }
      }),
      { numRuns: 200, seed: 1337 },
    );
  });
});
