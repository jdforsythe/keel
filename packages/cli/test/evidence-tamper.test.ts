// evidence-tamper (k.evidence Verify): a change to any file of a real bundle makes `keel evidence --verify` fail and
// name the file; E1062 for a content file, an added file and a removed one; E1063 for the manifest and the signature.
// The bundle is written by bundleWrite over a small project; the byte to flip comes from a seeded generator.
import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bundleVerify } from "../src/internal/bundleVerify.ts";
import { bundleWrite } from "../src/internal/bundleWrite.ts";
import type { Io } from "../src/types/Io.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const SLOW = 180_000;
const SEED = 1337;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const pem = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const keyId = createHash("sha256")
  .update(createPublicKey(pem).export({ format: "der", type: "spki" }).subarray(12))
  .digest("hex")
  .slice(0, 16);

const TREE: Record<string, string> = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['a'], adapter: 'node' },\n  app: { modules: ['c'], adapter: 'client' },\n})\n",
  "modules/a/User.schema.ts": `import { s } from "@keel/schema";
export const User = s.object({ name: s.string().pii("name"), age: s.int() });
`,
};

/** mulberry32: a seeded generator, so each mutation touches the same byte on every run. */
const prng = (seed: number): (() => number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

let pristine = "";
let names: string[] = [];

beforeAll(async () => {
  const cwd = mkdtempSync(join(here, ".tmp-tamper-"));
  dirs.push(cwd);
  for (const [path, text] of Object.entries(TREE)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), text);
  }
  const io: Io = {
    cwd,
    files: Object.entries(TREE).map(([path, source]) => ({ path, source })),
    env: { KEEL_EVIDENCE_KEY: pem, KEEL_SEED: String(SEED) },
  };
  await bundleWrite({ out: "bundle" }, io);
  pristine = join(cwd, "bundle");
  names = readdirSync(pristine).sort();
}, SLOW);

const copy = (): { cwd: string; dir: string } => {
  const cwd = mkdtempSync(join(here, ".tmp-tamper-copy-"));
  dirs.push(cwd);
  cpSync(pristine, join(cwd, "bundle"), { recursive: true });
  return { cwd, dir: join(cwd, "bundle") };
};
const verify = (cwd: string) => bundleVerify({ verify: "bundle", key: keyId }, { cwd });
const diags = (o: ReturnType<typeof verify>) =>
  o.records.flatMap((r) => (r.kind === "diag" ? [{ code: r.code, path: r.path, message: String(r.message) }] : []));
const code = (name: string): string => (name === "manifest.json" || name === "manifest.sig" ? "E1063" : "E1062");

describe("evidence tamper", () => {
  test("the pristine bundle holds the eight files and verifies", () => {
    expect(names).toEqual([
      "a11y.json",
      "check.ndjson",
      "deps.json",
      "ledger.ndjson",
      "manifest.json",
      "manifest.sig",
      "pii.json",
      "security.json",
    ]);
    const b = copy();
    expect(verify(b.cwd).records).toEqual([
      expect.objectContaining({ kind: "evidence", dir: "bundle", keyId, files: 6 }),
    ]);
  });

  const mutations: [string, (file: string, rnd: () => number) => void][] = [
    [
      "flip one byte",
      (file, rnd) => {
        const bytes = readFileSync(file);
        const i = Math.floor(rnd() * bytes.length);
        bytes[i] = (bytes[i] ?? 0) ^ 0x01;
        writeFileSync(file, bytes);
      },
    ],
    ["append one byte", (file) => writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from("x")]))],
    ["truncate", (file, rnd) => truncateSync(file, Math.floor(rnd() * Math.max(readFileSync(file).length - 1, 1)))],
    ["delete", (file) => rmSync(file)],
  ];

  for (const [label, mutate] of mutations) {
    test(`${label} of any bundle file fails verify with the file named`, () => {
      const rnd = prng(SEED);
      for (const name of names) {
        const b = copy();
        mutate(join(b.dir, name), rnd);
        const out = verify(b.cwd);
        const found = diags(out);
        expect(out.records.at(-1), `${label} ${name}`).toMatchObject({ kind: "summary", ok: false });
        expect(found.length, `${label} ${name}`).toBeGreaterThan(0);
        // The file is named by the diagnostic's path or, for a missing manifest or signature, by its message.
        const named = found.filter((d) => d.path === `bundle/${name}` || d.message.includes(name));
        expect(named.length, `${label} ${name}`).toBeGreaterThan(0);
        expect(
          named.map((d) => d.code),
          `${label} ${name}`,
        ).toEqual(named.map(() => code(name)));
      }
    });
  }

  test("an added file the manifest does not list is E1062 naming it", () => {
    const b = copy();
    writeFileSync(join(b.dir, "extra.txt"), "x");
    expect(diags(verify(b.cwd))).toEqual([
      { code: "E1062", path: "bundle/extra.txt", message: "extra.txt is not listed in the manifest" },
    ]);
    expect(existsSync(join(b.dir, "extra.txt"))).toBe(true);
  });
});
