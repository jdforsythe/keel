// bundleWrite (k.evidence Command, Signing): `keel evidence` in process over a project in a temp directory under the
// package's test directory: the refusals before anything is written, the eight files, the manifest and its Ed25519
// signature, E1060 for a run that records errors. The project is handed over as `io.files` (no test file, so no
// vitest run starts). Seed 1337.
import { createHash, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { KERNEL_SINK_RUNGS } from "../src/internal/KERNEL_SINK_RUNGS.ts";
import { bundleWrite } from "../src/internal/bundleWrite.ts";
import type { Input } from "../src/types/Input.ts";
import type { Io } from "../src/types/Io.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const SLOW = 180_000;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const pem = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

const USER = `import { s } from "@keel/schema";
export const User = s.object({
  name: s.string().pii("name"),
  addresses: s.array(s.object({ street: s.string().pii("location") })),
  age: s.int(),
});
`;
const base = (): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['a'], adapter: 'node' },\n  app: { modules: ['c'], adapter: 'client' },\n})\n",
  "modules/a/User.schema.ts": USER,
});

/** Writes `tree` into a fresh temp directory; the Io hands the same files over in memory. */
const make = (tree: Record<string, string>, env: Record<string, string> = {}, extra: Partial<Io> = {}) => {
  const cwd = mkdtempSync(join(here, ".tmp-bundleWrite-"));
  dirs.push(cwd);
  for (const [path, text] of Object.entries(tree)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), text);
  }
  const io: Io = {
    cwd,
    files: Object.entries(tree).map(([path, source]) => ({ path, source })),
    env: { KEEL_EVIDENCE_KEY: pem, KEEL_SEED: "1337", ...env },
    ...extra,
  };
  return { cwd, io };
};
const BUNDLE = [
  "a11y.json",
  "check.ndjson",
  "deps.json",
  "ledger.ndjson",
  "manifest.json",
  "manifest.sig",
  "pii.json",
  "security.json",
];
const LISTED = BUNDLE.filter((f) => f !== "manifest.json" && f !== "manifest.sig");
const readJson = (path: string): Record<string, unknown> => {
  const v: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof v !== "object" || v === null) throw new Error(`${path} is not an object`);
  return Object.fromEntries(Object.entries(v));
};
const lines = (path: string): Record<string, unknown>[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => {
      const v: unknown = JSON.parse(l);
      return typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v)) : {};
    });
const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const isE = (r: Record<string, unknown>): boolean => r.kind === "diag" && String(r.code).startsWith("E");

describe("bundleWrite: refusals", () => {
  test("bundleWrite without a usable KEEL_EVIDENCE_KEY is E1061 and writes nothing, whatever else is wrong", async () => {
    for (const key of [
      undefined,
      "",
      "not a key",
      rsa,
      "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n",
    ]) {
      const { cwd, io } = make(base(), key === undefined ? {} : { KEEL_EVIDENCE_KEY: key }, {});
      const noKey: Io = key === undefined ? { ...io, env: { KEEL_SEED: "1337" } } : io;
      const out = await bundleWrite({ out: "bundle", audit: "audit.json" }, noKey);
      expect(out.writes).toEqual([]);
      expect(out.records).toEqual([
        {
          kind: "diag",
          code: "E1061",
          message: "KEEL_EVIDENCE_KEY is absent or not an Ed25519 private key; nothing written",
          see: "k.evidence",
        },
        { kind: "summary", ok: false, name: "evidence", counts: { files: 0 } },
      ]);
      expect(existsSync(join(cwd, "bundle"))).toBe(false);
      expect(existsSync(join(cwd, "evidence"))).toBe(false);
    }
    const noEnv = await bundleWrite({}, { cwd: here });
    expect(noEnv.records[0]).toMatchObject({ code: "E1061" });
  });

  test("an --audit file that is not pnpm audit --json output is E1064 and writes nothing", async () => {
    for (const text of [undefined, "", "{", "[]", JSON.stringify({ advisories: {} })]) {
      const { cwd, io } = make(base(), {}, { read: (p) => (p === "audit.json" ? text : undefined) });
      const out = await bundleWrite({ audit: "audit.json", out: "bundle" }, io);
      expect(out.records).toEqual([
        {
          kind: "diag",
          code: "E1064",
          message: "--audit file is not pnpm audit --json output; nothing written",
          see: "k.evidence",
        },
        { kind: "summary", ok: false, name: "evidence", counts: { files: 0 } },
      ]);
      expect(existsSync(join(cwd, "bundle"))).toBe(false);
    }
  });

  test("the key is checked before the audit file", async () => {
    const { io } = make(base(), { KEEL_EVIDENCE_KEY: "x" }, { read: () => "{" });
    const out = await bundleWrite({ audit: "a.json" }, io);
    expect(out.records[0]).toMatchObject({ code: "E1061" });
  });
});

describe("bundleWrite: the bundle", () => {
  test(
    "a clean project writes exactly the eight files to --out and reports one evidence summary with six files",
    async () => {
      const { cwd, io } = make(base());
      const out = await bundleWrite({ out: "bundle" }, io);
      expect(out.writes).toEqual([]);
      expect(out.records).toEqual([{ kind: "summary", ok: true, name: "evidence", counts: { files: 6 } }]);
      expect(readdirSync(join(cwd, "bundle")).sort()).toEqual(BUNDLE);
      expect(existsSync(join(cwd, "evidence"))).toBe(false);
    },
    SLOW,
  );

  test(
    "without --out the directory is evidence/<UTC date of the run> and the manifest's at is that run's ISO time",
    async () => {
      const { cwd, io } = make(base());
      await bundleWrite({}, io);
      const dirsMade = readdirSync(join(cwd, "evidence"));
      expect(dirsMade).toHaveLength(1);
      const day = dirsMade[0] ?? "";
      expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const manifest = readJson(join(cwd, "evidence", day, "manifest.json"));
      expect(String(manifest.at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(String(manifest.at).slice(0, 10)).toBe(day);
      expect(readdirSync(join(cwd, "evidence", day)).sort()).toEqual(BUNDLE);
    },
    SLOW,
  );

  test(
    "the manifest names the app, key and keyId, and lists each other file's SHA-256 and size; its signature verifies",
    async () => {
      const tree = base();
      const { cwd, io } = make(tree);
      mkdirSync(join(cwd, "node_modules", "@keel", "zeta"), { recursive: true });
      mkdirSync(join(cwd, "node_modules", "@keel", "alpha"), { recursive: true });
      mkdirSync(join(cwd, "node_modules", "@keel", "broken"), { recursive: true });
      writeFileSync(
        join(cwd, "node_modules", "@keel", "zeta", "package.json"),
        '{"name":"@keel/zeta","version":"2.0.1"}',
      );
      writeFileSync(
        join(cwd, "node_modules", "@keel", "alpha", "package.json"),
        '{"name":"@keel/alpha","version":"0.3.0"}',
      );
      writeFileSync(join(cwd, "node_modules", "@keel", "broken", "package.json"), "{");
      await bundleWrite(
        { out: "bundle" },
        { ...io, read: (p) => (p === "package.json" ? tree["package.json"] : undefined) },
      );
      const dir = join(cwd, "bundle");
      const m = readJson(join(dir, "manifest.json"));
      const pub = createPublicKey(pem).export({ format: "der", type: "spki" }).subarray(12);
      expect(m.v).toBe(1);
      expect(m.app).toBe("fx");
      expect(m.key).toBe(pub.toString("base64"));
      expect(m.keyId).toBe(createHash("sha256").update(pub).digest("hex").slice(0, 16));
      expect(m.keel).toEqual({ "@keel/alpha": "0.3.0", "@keel/zeta": "2.0.1" });
      expect(m.runs).toEqual({ checkErrors: 0, failedTests: 0 });
      expect(m.files).toEqual(
        LISTED.map((path) => ({
          path,
          sha256: sha(readFileSync(join(dir, path))),
          bytes: readFileSync(join(dir, path)).byteLength,
        })),
      );
      const sig = readFileSync(join(dir, "manifest.sig"), "utf8");
      expect(sig.endsWith("\n")).toBe(true);
      expect(
        verify(null, readFileSync(join(dir, "manifest.json")), createPublicKey(pem), Buffer.from(sig.trim(), "base64")),
      ).toBe(true);
      expect(readFileSync(join(dir, "manifest.json"), "utf8").endsWith("}\n")).toBe(true);
      expect(readFileSync(join(dir, "manifest.json"), "utf8")).toContain('\n  "v": 1,');
    },
    SLOW,
  );

  test(
    "the app is the directory's name without a readable package.json name; source is null or a commit and a flag",
    async () => {
      for (const read of [undefined, () => undefined, () => "{", () => JSON.stringify({ name: 3 }), () => "[]"]) {
        const { cwd, io } = make(base(), {}, read === undefined ? {} : { read });
        await bundleWrite({ out: "bundle" }, io);
        const m = readJson(join(cwd, "bundle", "manifest.json"));
        expect(m.app).toBe(cwd.split("/").pop());
        const src = m.source;
        if (src !== null) {
          expect(src).toMatchObject({ commit: expect.stringMatching(/^[0-9a-f]{40,64}$/), dirty: expect.any(Boolean) });
        }
      }
    },
    SLOW,
  );

  test(
    "deps.json has advisories null without --audit, and the audit's advisories by id with it",
    async () => {
      const audit = JSON.stringify({
        advisories: {
          b: {
            id: 9,
            module_name: "m9",
            severity: "low",
            title: "t9",
            url: "u9",
            vulnerable_versions: "<2",
            patched_versions: ">=2",
          },
          a: {
            id: 3,
            module_name: "m3",
            severity: "high",
            title: "t3",
            url: "u3",
            vulnerable_versions: "<1",
            patched_versions: ">=1",
          },
        },
        metadata: { vulnerabilities: { high: 1, low: 1 } },
      });
      const a = make(base());
      await bundleWrite({ out: "bundle" }, a.io);
      const none = readJson(join(a.cwd, "bundle", "deps.json"));
      expect(none.bomFormat).toBe("CycloneDX");
      expect(none.specVersion).toBe("1.5");
      expect(none.advisories).toBeNull();
      const b = make(base(), {}, { read: (p) => (p === "audit.json" ? audit : undefined) });
      await bundleWrite({ out: "bundle", audit: "audit.json" }, b.io);
      const given = readJson(join(b.cwd, "bundle", "deps.json"));
      expect(given.advisories).toEqual([
        { id: 3, module: "m3", severity: "high", title: "t3", url: "u3", vulnerable: "<1", patched: ">=1" },
        { id: 9, module: "m9", severity: "low", title: "t9", url: "u9", vulnerable: "<2", patched: ">=2" },
      ]);
    },
    SLOW,
  );

  test(
    "pii.json lists the schema's marked paths and the kernel ledger's rung for each sink; coverage follows",
    async () => {
      const { cwd, io } = make(base());
      await bundleWrite({ out: "bundle" }, io);
      const pii = readJson(join(cwd, "bundle", "pii.json"));
      expect(pii.paths).toEqual([
        { file: "modules/a/User.schema.ts", export: "User", path: "name", class: "name" },
        { file: "modules/a/User.schema.ts", export: "User", path: "addresses.*.street", class: "location" },
      ]);
      expect(pii.unread).toEqual([]);
      const sinks = pii.sinks;
      expect(
        Array.isArray(sinks) ? sinks.map((s: { clause: string; rung: string }) => [s.clause, s.rung]) : [],
      ).toEqual(Object.entries(KERNEL_SINK_RUNGS).map(([clause, rung]) => [clause, rung]));
      expect(pii.coverage).toBe(1);
    },
    SLOW,
  );

  test(
    "security.json holds a node deployable's policy with <nonce> and a client deployable's csp; a11y.json holds the criteria for a person",
    async () => {
      const { cwd, io } = make(base());
      await bundleWrite({ out: "bundle" }, io);
      const sec = readJson(join(cwd, "bundle", "security.json"));
      const deployables = sec.deployables;
      expect(
        Array.isArray(deployables)
          ? deployables.map((d: { name: string; adapter: string }) => [d.name, d.adapter])
          : [],
      ).toEqual([
        ["app", "client"],
        ["web", "node"],
      ]);
      expect(JSON.stringify(sec)).toContain("'nonce-<nonce>'");
      const a11y = readJson(join(cwd, "bundle", "a11y.json"));
      expect(a11y.v).toBe(1);
      expect(Array.isArray(a11y.person) && a11y.person.length > 0).toBe(true);
      expect(a11y.contrast).toEqual([]);
    },
    SLOW,
  );

  test(
    "check.ndjson holds the check records without their message text, and ledger.ndjson the ledger records",
    async () => {
      const tree = { ...base(), "modules/a/Bad.ts": "export const Bad = 1\nexport const Extra = 2\n" };
      const { cwd, io } = make(tree);
      await bundleWrite({ out: "bundle" }, io);
      const check = lines(join(cwd, "bundle", "check.ndjson"));
      expect(check.some(isE)).toBe(true);
      for (const r of check) {
        expect(r).not.toHaveProperty("message");
        expect(r).not.toHaveProperty("fix");
      }
      expect(check.find((r) => r.kind === "diag")).toMatchObject({ code: "E1752", path: "modules/a/Bad.ts" });
      expect(lines(join(cwd, "bundle", "ledger.ndjson")).length).toBeGreaterThan(0);
    },
    SLOW,
  );

  test(
    "a check error still writes the bundle: each check error comes first, then E1060 naming the counts, the manifest and the first error, and runs counts the error",
    async () => {
      const tree = { ...base(), "modules/a/Bad.ts": "export const Bad = 1\nexport const Extra = 2\n" };
      const { cwd, io } = make(tree);
      const out = await bundleWrite({ out: "bundle/" }, io);
      const errors = lines(join(cwd, "bundle", "check.ndjson")).filter(isE).length;
      expect(errors).toBeGreaterThan(0);
      expect(readJson(join(cwd, "bundle", "manifest.json")).runs).toEqual({ checkErrors: errors, failedTests: 0 });
      const word = errors === 1 ? "error" : "errors";
      const shown = out.records.filter((r) => r.kind === "diag" && r.code !== "E1060");
      expect(shown.length).toBe(errors);
      const first = shown[0];
      expect(first).toMatchObject({ code: "E1752", path: "modules/a/Bad.ts" });
      expect(out.records.slice(errors)).toEqual([
        {
          kind: "diag",
          code: "E1060",
          path: "bundle/manifest.json",
          message: `bundle written with ${errors} check ${word} and 0 failed tests`,
          fix: `first: modules/a/Bad.ts:${String(first?.line)}:${String(first?.col)} ${String(first?.message)}`,
          see: "k.evidence",
        },
        { kind: "summary", ok: false, name: "evidence", counts: { files: 6 } },
      ]);
      expect(readdirSync(join(cwd, "bundle")).sort()).toEqual(BUNDLE);
    },
    SLOW,
  );

  test(
    "under one seed two runs on an unchanged project write byte-equal bundles; the seed must be digits to pin the clock",
    async () => {
      const { cwd, io } = make(base());
      const input: Input = { out: "bundle" };
      const read = (): string[] => BUNDLE.map((f) => readFileSync(join(cwd, "bundle", f), "utf8"));
      await bundleWrite(input, io);
      const first = read();
      await bundleWrite(input, io);
      expect(read()).toEqual(first);
      for (const seed of ["1337", "42"]) {
        const x = make(base(), { KEEL_SEED: seed });
        await bundleWrite(input, x.io);
        const y = make(base(), { KEEL_SEED: seed });
        await bundleWrite(input, y.io);
        expect(readJson(join(x.cwd, "bundle", "manifest.json")).at).toBe(
          readJson(join(y.cwd, "bundle", "manifest.json")).at,
        );
      }
    },
    SLOW,
  );

  test(
    "property: the manifest's runs.checkErrors equals the error records of check.ndjson, and E1060 appears exactly when it is not 0",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (bad) => {
          const tree: Record<string, string> = base();
          for (let i = 0; i < bad; i++) tree[`modules/a/Bad${i}.ts`] = "export const A = 1\nexport const B = 2\n";
          const { cwd, io } = make(tree);
          const out = await bundleWrite({ out: "bundle" }, io);
          const errors = lines(join(cwd, "bundle", "check.ndjson")).filter(isE).length;
          expect(readJson(join(cwd, "bundle", "manifest.json")).runs).toEqual({ checkErrors: errors, failedTests: 0 });
          expect(out.records.some((r) => r.kind === "diag" && r.code === "E1060")).toBe(errors > 0);
          expect(errors > 0).toBe(bad > 0);
        }),
        { seed: 1337, numRuns: 5 },
      );
    },
    SLOW * 2,
  );
});
