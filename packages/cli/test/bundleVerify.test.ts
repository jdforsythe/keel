// bundleVerify (k.evidence Verify): `keel evidence --verify <dir> --key <keyId>`: E1063 for a manifest, key or
// signature that does not hold, E1062 naming each file that is missing, changed, unlisted or does not parse, and one
// evidence record for a bundle that verifies. Seed 1337.
import { type KeyObject, generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { bundleVerify } from "../src/internal/bundleVerify.ts";
import { keyIdOf } from "../src/internal/keyIdOf.ts";
import { sha256Hex } from "../src/internal/sha256Hex.ts";
import type { Input } from "../src/types/Input.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;
const REPORTS: Record<string, string> = {
  "a11y.json": json({ v: 1, claims: [], person: [], contrast: [] }),
  "check.ndjson": `${JSON.stringify({ kind: "summary", ok: true, name: "check", counts: { files: 1 } })}\n`,
  "deps.json": json({ bomFormat: "CycloneDX", specVersion: "1.5", components: [], advisories: null }),
  "ledger.ndjson": `${JSON.stringify({ kind: "ledger", item: "k.cli#1", rung: "example", evidence: "example t.ts" })}\n`,
  "pii.json": json({ v: 1, paths: [], sinks: [], coverage: 1, unread: [], caller: { days: null, class: null } }),
  "security.json": json({ v: 1, deployables: [] }),
};
const NAMES = Object.keys(REPORTS);
const pair = (): { privateKey: KeyObject; raw: Buffer; id: string } => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(12);
  return { privateKey, raw, id: keyIdOf(raw) };
};
const MAIN = pair();

type Spec = {
  /** Report files to write (default: all six, valid). */
  reports?: Record<string, string>;
  /** Paths the manifest lists (default: the reports' names). */
  list?: string[];
  /** Text the manifest hashes for a path, instead of the file's own. */
  hashed?: Record<string, string>;
  /** Fields merged into the manifest. */
  patch?: Record<string, unknown>;
  /** Signature file text; default: the base64 signature of the manifest and a newline. */
  sig?: (manifest: Buffer, key: KeyObject) => string | undefined;
  /** Written as is, beside the others. */
  extra?: Record<string, string>;
  key?: typeof MAIN;
};
const bundle = (spec: Spec = {}): { cwd: string; dir: string; id: string } => {
  const cwd = tempDir("keel-verify-");
  dirs.push(cwd);
  const dir = join(cwd, "out");
  mkdirSync(dir);
  const k = spec.key ?? MAIN;
  const reports = spec.reports ?? REPORTS;
  for (const [n, t] of Object.entries(reports)) writeFileSync(join(dir, n), t);
  for (const [n, t] of Object.entries(spec.extra ?? {})) writeFileSync(join(dir, n), t);
  const manifest = json({
    v: 1,
    app: "fx",
    at: "2026-03-04T05:06:07.000Z",
    source: null,
    keel: {},
    key: k.raw.toString("base64"),
    keyId: k.id,
    runs: { checkErrors: 0, failedTests: 0 },
    files: (spec.list ?? Object.keys(reports)).map((path) => {
      const text = spec.hashed?.[path] ?? reports[path] ?? "";
      return { path, sha256: sha256Hex(Buffer.from(text)), bytes: Buffer.byteLength(text) };
    }),
    ...(spec.patch ?? {}),
  });
  writeFileSync(join(dir, "manifest.json"), manifest);
  const sig =
    spec.sig === undefined
      ? `${sign(null, Buffer.from(manifest), k.privateKey).toString("base64")}\n`
      : spec.sig(Buffer.from(manifest), k.privateKey);
  if (sig !== undefined) writeFileSync(join(dir, "manifest.sig"), sig);
  return { cwd, dir, id: k.id };
};
const verify = (b: { cwd: string; id: string }, over: { verify?: string; key?: string | null } = {}) => {
  const key = over.key === undefined ? b.id : over.key;
  const input: Input = key === null ? { verify: over.verify ?? "out" } : { verify: over.verify ?? "out", key };
  return bundleVerify(input, { cwd: b.cwd });
};
const diags = (o: ReturnType<typeof verify>) =>
  o.records.flatMap((r) => (r.kind === "diag" ? [{ code: r.code, message: r.message, path: r.path, see: r.see }] : []));
const trailer = (o: ReturnType<typeof verify>) => o.records.at(-1);
const FAILED = { kind: "summary", ok: false, name: "evidence --verify", counts: { files: 0 } };

describe("bundleVerify", () => {
  test("bundleVerify of an untouched bundle emits one evidence record with the manifest's date, key id and file count", () => {
    const b = bundle();
    const out = verify(b);
    expect(out.writes).toEqual([]);
    expect(out.records).toEqual([
      { kind: "evidence", dir: "out", at: "2026-03-04T05:06:07.000Z", keyId: b.id, files: 6 },
    ]);
  });

  test("the dir shown loses one trailing slash and is resolved against cwd; an absolute path works", () => {
    const b = bundle();
    expect(verify(b, { verify: "out/" }).records[0]).toMatchObject({ kind: "evidence", dir: "out" });
    expect(verify(b, { verify: `${b.cwd}/out` }).records[0]).toMatchObject({ kind: "evidence", dir: `${b.cwd}/out` });
    expect(diags(verify(b, { verify: "nope/" }))[0]?.path).toBe("nope/manifest.json");
  });

  test("a missing directory, manifest or signature, or a manifest that is not JSON or not the schema, is E1063", () => {
    const cases: Spec[] = [
      { sig: () => undefined },
      { patch: { v: 2 } },
      { patch: { keyId: "short" } },
      { patch: { files: "x" } },
      { patch: { source: { commit: 1, dirty: false } } },
    ];
    for (const spec of cases) {
      const out = verify(bundle(spec));
      expect(diags(out)).toEqual([
        {
          code: "E1063",
          message: "manifest.json or manifest.sig missing or unreadable",
          path: "out/manifest.json",
          see: "k.evidence",
        },
      ]);
      expect(trailer(out)).toEqual(FAILED);
    }
    const none = verify({ cwd: bundle().cwd, id: "x" }, { verify: "absent", key: "x" });
    expect(diags(none)[0]).toMatchObject({ code: "E1063", path: "absent/manifest.json" });
    const garbage = bundle();
    writeFileSync(join(garbage.dir, "manifest.json"), "{ nope");
    expect(diags(verify(garbage))[0]?.code).toBe("E1063");
    const dirSig = bundle({ sig: () => undefined });
    mkdirSync(join(dirSig.dir, "manifest.sig"));
    expect(diags(verify(dirSig))[0]?.message).toBe("manifest.json or manifest.sig missing or unreadable");
    const dirManifest = bundle();
    rmSync(join(dirManifest.dir, "manifest.json"));
    mkdirSync(join(dirManifest.dir, "manifest.json"));
    expect(diags(verify(dirManifest))[0]?.message).toBe("manifest.json or manifest.sig missing or unreadable");
  });

  test("without --key the bundle is not trusted: E1063 asks for it", () => {
    const out = verify(bundle(), { key: null });
    expect(diags(out)).toEqual([
      {
        code: "E1063",
        message: "--verify needs --key <keyId>, the id the project publishes",
        path: "out/manifest.json",
        see: "k.evidence",
      },
    ]);
    expect(trailer(out)).toEqual(FAILED);
  });

  test("a --key that is not the id of the bundle's key is E1063 naming at most 16 characters of it", () => {
    const b = bundle();
    const other = "0123456789abcdef0123456789abcdef";
    expect(diags(verify(b, { key: other }))).toEqual([
      {
        code: "E1063",
        message: "bundle key is not --key 0123456789abcdef",
        path: "out/manifest.json",
        see: "k.evidence",
      },
    ]);
    expect(diags(verify(b, { key: "abc" }))[0]?.message).toBe("bundle key is not --key abc");
    expect(diags(verify(b, { key: "" }))[0]?.code).toBe("E1063");
  });

  test("a manifest whose keyId is not the --key is E1063 naming both, though the key's own id is --key", () => {
    const b = bundle({ patch: { keyId: "0000000000000000" } });
    expect(diags(verify(b))).toEqual([
      {
        code: "E1063",
        message: `manifest keyId 0000000000000000 is not --key ${b.id}`,
        path: "out/manifest.json",
        see: "k.evidence",
      },
    ]);
  });

  test("a signature that does not verify is E1063 at manifest.sig naming the key id", () => {
    const wrong = pair();
    const cases: [string, Spec][] = [
      ["another key signed", { sig: (m) => `${sign(null, m, wrong.privateKey).toString("base64")}\n` }],
      ["signed other bytes", { sig: (_m, k) => `${sign(null, Buffer.from("x"), k).toString("base64")}\n` }],
      ["no newline", { sig: (m, k) => sign(null, m, k).toString("base64") }],
      ["two newlines", { sig: (m, k) => `${sign(null, m, k).toString("base64")}\n\n` }],
      [
        "stray character",
        {
          sig: (m, k) =>
            `${sign(null, m, k).toString("base64").slice(0, 10)}!${sign(null, m, k).toString("base64").slice(10)}\n`,
        },
      ],
      ["empty", { sig: () => "" }],
      ["newline only", { sig: () => "\n" }],
      ["not base64", { sig: () => "zz zz\n" }],
    ];
    for (const [why, spec] of cases) {
      const b = bundle(spec);
      expect(diags(verify(b)), why).toEqual([
        {
          code: "E1063",
          message: `manifest.json or manifest.sig changed (key ${b.id})`,
          path: "out/manifest.sig",
          see: "k.evidence",
        },
      ]);
    }
  });

  test("a key that is not 32 bytes is never accepted, even when its id is the --key", () => {
    for (const len of [0, 1, 31, 33]) {
      const raw = Buffer.alloc(len, 7);
      const fake = { ...MAIN, raw, id: keyIdOf(raw) };
      const b = bundle({ key: fake, sig: () => `${Buffer.alloc(64, 1).toString("base64")}\n` });
      expect(diags(verify(b))[0], String(len)).toMatchObject({ code: "E1063", path: "out/manifest.sig" });
    }
  });

  test("a bundle file the manifest does not list is E1062 naming it, once per file", () => {
    const b = bundle({ list: NAMES.filter((n) => n !== "pii.json") });
    const out = diags(verify(b));
    expect(out).toContainEqual({
      code: "E1062",
      message: "pii.json is not listed in the manifest",
      path: "out/pii.json",
      see: "k.evidence",
    });
    const extra = diags(verify(bundle({ extra: { "notes.txt": "x" } })));
    expect(extra).toEqual([
      { code: "E1062", message: "notes.txt is not listed in the manifest", path: "out/notes.txt", see: "k.evidence" },
    ]);
  });

  test("a directory inside the bundle is an unlisted entry", () => {
    const b = bundle();
    mkdirSync(join(b.dir, "sub"));
    expect(diags(verify(b))).toEqual([
      { code: "E1062", message: "sub is not listed in the manifest", path: "out/sub", see: "k.evidence" },
    ]);
  });

  test("a listed file that is missing, or a directory in its place, is E1062 'missing'", () => {
    const missing = bundle({
      reports: Object.fromEntries(Object.entries(REPORTS).filter(([n]) => n !== "deps.json")),
      list: NAMES,
    });
    expect(diags(verify(missing))).toEqual([
      { code: "E1062", message: "deps.json missing", path: "out/deps.json", see: "k.evidence" },
    ]);
    const dir = bundle({
      reports: Object.fromEntries(Object.entries(REPORTS).filter(([n]) => n !== "deps.json")),
      list: NAMES,
    });
    mkdirSync(join(dir.dir, "deps.json"));
    expect(diags(verify(dir))).toEqual([
      { code: "E1062", message: "deps.json missing", path: "out/deps.json", see: "k.evidence" },
    ]);
  });

  test("a listed file whose size or SHA-256 differs from the manifest is E1062 'changed since signing'", () => {
    const sameSize = (REPORTS["pii.json"] ?? "").replace('"v": 1', '"v": 2');
    expect(sameSize.length).toBe((REPORTS["pii.json"] ?? "").length);
    for (const edited of [sameSize, `${REPORTS["pii.json"]} `, ""]) {
      const b = bundle({
        reports: { ...REPORTS, "pii.json": edited },
        hashed: { "pii.json": REPORTS["pii.json"] ?? "" },
      });
      expect(diags(verify(b))).toEqual([
        { code: "E1062", message: "pii.json changed since signing", path: "out/pii.json", see: "k.evidence" },
      ]);
    }
    const sameHashDifferentSize = bundle({
      patch: { files: NAMES.map((path) => ({ path, sha256: sha256Hex(Buffer.from(REPORTS[path] ?? "")), bytes: 1 })) },
    });
    expect(diags(verify(sameHashDifferentSize)).map((d) => d.message)).toEqual(
      NAMES.map((n) => `${n} changed since signing`),
    );
  });

  test("a listed file with the right hash that does not parse with its schema is E1062; ndjson is judged line by line", () => {
    const bad: [string, string][] = [
      ["pii.json", "not json"],
      ["pii.json", json({ v: 1 })],
      ["security.json", json({ v: 2, deployables: [] })],
      ["check.ndjson", "{ nope\n"],
      [
        "check.ndjson",
        `${JSON.stringify({ kind: "summary", ok: true, name: "check", counts: { files: 1 } })}\n${JSON.stringify({ nope: 1 })}\n`,
      ],
    ];
    for (const [name, text] of bad) {
      const b = bundle({ reports: { ...REPORTS, [name]: text } });
      expect(diags(verify(b)), `${name} ${text}`).toEqual([
        { code: "E1062", message: `${name} does not parse with its schema`, path: `out/${name}`, see: "k.evidence" },
      ]);
    }
    const blanks = bundle({ reports: { ...REPORTS, "check.ndjson": `\n${REPORTS["check.ndjson"]}\n\n` } });
    expect(verify(blanks).records[0]).toMatchObject({ kind: "evidence", files: 6 });
  });

  test("a listed path that is not a bundle file is E1062 'not a bundle file'", () => {
    const b = bundle({ reports: { ...REPORTS, "evil.txt": "x" } });
    expect(diags(verify(b))).toEqual([
      { code: "E1062", message: "evil.txt is not a bundle file", path: "out/evil.txt", see: "k.evidence" },
    ]);
  });

  test("a failing bundle reports every problem and one failed trailer with files 0", () => {
    const b = bundle({
      reports: { ...REPORTS, "pii.json": "x" },
      hashed: { "security.json": "y" },
      extra: { "a.txt": "1", "b.txt": "2" },
    });
    const out = verify(b);
    expect(
      diags(out)
        .map((d) => d.message)
        .sort(),
    ).toEqual(
      [
        "a.txt is not listed in the manifest",
        "b.txt is not listed in the manifest",
        "pii.json does not parse with its schema",
        "security.json changed since signing",
      ].sort(),
    );
    expect(trailer(out)).toEqual(FAILED);
    expect(out.records).toHaveLength(5);
  });

  test("property: each unlisted file is one E1062 and nothing else changes; the check fails unless there are none", () => {
    const name = fc.stringMatching(/^[a-z]{1,8}\.txt$/);
    fc.assert(
      fc.property(fc.uniqueArray(name, { maxLength: 4 }), (extras) => {
        const b = bundle({ extra: Object.fromEntries(extras.map((n) => [n, "x"])) });
        const out = verify(b);
        if (extras.length === 0) expect(out.records).toHaveLength(1);
        else {
          expect(
            diags(out)
              .map((d) => d.message)
              .sort(),
          ).toEqual(extras.map((n) => `${n} is not listed in the manifest`).sort());
          expect(trailer(out)).toEqual(FAILED);
        }
      }),
      { seed: 1337, numRuns: 25 },
    );
  });
});
