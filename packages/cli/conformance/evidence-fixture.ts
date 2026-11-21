// Fixtures for the k.evidence conformance files (not a test file). Property seed: 1337.
// The real `keel` binary over a temp project (OS tmpdir). The environment is the one place the key is read, so the
// runner here passes `KEEL_EVIDENCE_KEY` itself; `KEEL_SEED` is pinned to 1337 for the sim ctx the command builds.
// ASSUMED (the spec names no way to pin the clock from outside): the command's sim clock is fixed by `KEEL_SEED` alone.
import { spawnSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign as signBytes } from "node:crypto";
import { cpSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Tree, materialize } from "./compat-support.ts";

export const SEED = 1337;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const BIN = join(root, "packages", "cli", "src", "bin.ts");

/** A TEST KEY ONLY: an Ed25519 private key (PKCS#8 PEM) generated for these tests. It guards nothing. */
export const TEST_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIHEW1/h6IVgwfKYLNGXd74rWfSxyGfYIFbZXiH5iCIUZ
-----END PRIVATE KEY-----
`;

/** A fresh private key as PKCS#8 PEM, generated inside the test (the bytes are never relied on). */
export function newKeyPem(kind: "ed25519" | "rsa"): string {
  const pair =
    kind === "ed25519" ? generateKeyPairSync("ed25519") : generateKeyPairSync("rsa", { modulusLength: 2048 });
  return pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

/** The manifest's `key` (raw public key, base64) and `keyId` (first 16 hex of its SHA-256) for a private key PEM. */
export function keyOf(pem: string): { key: string; keyId: string } {
  const jwk = createPublicKey(createPrivateKey(pem)).export({ format: "jwk" });
  if (typeof jwk.x !== "string") throw new Error("not an OKP key");
  const raw = Buffer.from(jwk.x, "base64url");
  return { key: raw.toString("base64"), keyId: createHash("sha256").update(raw).digest("hex").slice(0, 16) };
}

/** The base64 Ed25519 signature of `bytes` under `pem`. */
export const signWith = (pem: string, bytes: Buffer): string =>
  signBytes(null, bytes, createPrivateKey(pem)).toString("base64");

/** The eight files `keel evidence` writes (k.evidence Command), and the six the manifest lists. */
export const BUNDLE_FILES: readonly string[] = [
  "a11y.json",
  "check.ndjson",
  "deps.json",
  "ledger.ndjson",
  "manifest.json",
  "manifest.sig",
  "pii.json",
  "security.json",
];
export const LISTED_FILES: readonly string[] = BUNDLE_FILES.filter(
  (f) => f !== "manifest.json" && f !== "manifest.sig",
);

// ---- the fixture project ----

/** Personal values the fixture's store and test hold; none may reach a bundle file. */
export const PII_VALUES = { name: "Zq7xMargaretOkafor", email: "zq7x.okafor@example.test", street: "Zq7x41TernLane" };

export const USER_SCHEMA_SOURCE = `import { s } from "@keel/schema";

export const User = s.object({
  name: s.string().pii("name"),
  email: s.string().pii("contact"),
  addresses: s.array(s.object({ street: s.string().pii("location") })),
  age: s.int(),
});
`;
/** Every marked leaf of `User`, in declaration order: path as written by `piiPaths` (array items `*`) and its class. */
export const USER_PII: readonly { path: string; class: string }[] = [
  { path: "name", class: "name" },
  { path: "email", class: "contact" },
  { path: "addresses.*.street", class: "location" },
];

/** The four sink clauses whose rung decides `pii.json` coverage: section and 1-based Conformance sentence. */
export const SINK_CLAUSES = [
  { id: "std.sessions#2", spec: "spec/std/std.sessions.md", section: "std.sessions", n: 2 },
  { id: "k.privacy#7", spec: "spec/kernel/k.privacy.md", section: "k.privacy", n: 7 },
  { id: "k.privacy#6", spec: "spec/kernel/k.privacy.md", section: "k.privacy", n: 6 },
  { id: "k.evidence#5", spec: "spec/kernel/k.evidence.md", section: "k.evidence", n: 5 },
] as const;
export type SinkId = (typeof SINK_CLAUSES)[number]["id"];

const repoFile = (path: string): string => readFileSync(join(root, path), "utf8");

/** The `n`th (1-based) bullet of a spec file's `**Conformance.**` list, verbatim. */
export function clauseText(specPath: string, n: number): string {
  const lines = repoFile(specPath).split("\n");
  const at = lines.findIndex((l) => l.startsWith("**Conformance.**"));
  const bullets: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (l.startsWith("- ")) bullets.push(l.slice(2));
    else if (bullets.length > 0 && l.trim() === "") break;
  }
  const text = bullets[n - 1];
  if (text === undefined) throw new Error(`${specPath} has no clause ${n}`);
  return text;
}

const citingTest = (section: string, clause: string, property: boolean): string =>
  property
    ? `// Spec: ${section}, clause "${clause}"
import fc from "fast-check";
import { expect, it } from "vitest";

it("holds for every integer", () => {
  fc.assert(
    fc.property(fc.integer(), (n) => {
      expect(n + 0).toBe(n);
    }),
    { numRuns: 100, seed: 1337 },
  );
});
`
    : `// Spec: ${section}, clause "${clause}"
import { expect, it } from "vitest";

it("holds for one value", () => {
  expect(1 + 1).toBe(2);
});
`;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const routesSrc = (id: string, path: string): string =>
  `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nimport { Text } from '@keel/ui'\nconst Page = () => Text({ id: '${id}.page.text', children: '${id}' })\nexport const routes = manifest(${id}, { '${id}.page': { component: Page } })\n`;
const contractSrc = (id: string, path: string): string =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '${path}' } })\n`;

export type FixtureOptions = {
  /** A test that fails (one failed test in `runs`). */
  failingTest?: boolean;
  /** A file with two exports (one `keel check` error, E1752). */
  checkError?: boolean;
  /** The sink clauses a seeded 100-run property cites; the others are cited by an example only. Default: all four. */
  probabilisticSinks?: readonly SinkId[];
  /** Replaces the fixture's `User.schema.ts` source. */
  userSchema?: string;
  /** Added or replacing files. */
  extra?: Tree;
};

/** A `node` deployable `web` (module `a`, with `.pii()` schema, store and test) and a `client` one `app` (module `c`). */
export function fixtureTree(o: FixtureOptions = {}): Tree {
  const probabilistic = o.probabilisticSinks ?? SINK_CLAUSES.map((c) => c.id);
  const tree: Tree = {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
    "topology.ts":
      "import { topology } from '@keel/server'\n" +
      "export default topology({\n" +
      "  web: { modules: ['a'], adapter: 'node' },\n" +
      "  app: { modules: ['c'], adapter: 'client' },\n" +
      "})\n",
    "modules/a/module.ts": manifestSrc("a"),
    "modules/a/routes.ts": routesSrc("a", "/a"),
    "modules/a/a.contract.ts": contractSrc("a", "/a"),
    "modules/a/User.schema.ts": o.userSchema ?? USER_SCHEMA_SOURCE,
    "modules/a/Profile.ts": `import { store } from "@keel/store";
import { User } from "./User.schema.ts";

export const Profile = store(
  User,
  { name: "${PII_VALUES.name}", email: "${PII_VALUES.email}", addresses: [{ street: "${PII_VALUES.street}" }], age: 41 },
  { id: "a.profile" },
);
`,
    "modules/c/module.ts": manifestSrc("c"),
    "modules/c/routes.ts": routesSrc("c", "/"),
    "modules/c/c.contract.ts": contractSrc("c", "/"),
    "packages/m/test/profile.test.ts": `import { expect, it } from "vitest";

it("keeps the profile values", () => {
  const held = ["${PII_VALUES.name}", "${PII_VALUES.email}", "${PII_VALUES.street}"];
  expect(held).toHaveLength(3);
});
`,
    "spec/kernel/k.privacy.md": repoFile("spec/kernel/k.privacy.md"),
    "spec/kernel/k.evidence.md": repoFile("spec/kernel/k.evidence.md"),
    "spec/std/std.sessions.md": repoFile("spec/std/std.sessions.md"),
  };
  for (const c of SINK_CLAUSES) {
    tree[`packages/m/conformance/sink-${c.id.replace(/[^a-z0-9]/gi, "-")}.test.ts`] = citingTest(
      c.section,
      clauseText(c.spec, c.n),
      probabilistic.includes(c.id),
    );
  }
  if (o.failingTest)
    tree["packages/m/test/failing.test.ts"] = `import { expect, it } from "vitest";

it("fails on purpose", () => {
  expect(1).toBe(2);
});
`;
  if (o.checkError) tree["modules/a/Bad.ts"] = "export const Bad = 1\nexport const Extra = 2\n";
  return { ...tree, ...(o.extra ?? {}) };
}

/** A hand-written `pnpm audit --json` document with one advisory; no network is involved. */
export const AUDIT_JSON = `${JSON.stringify(
  {
    advisories: {
      "1100001": {
        id: 1100001,
        module_name: "left-padx",
        severity: "high",
        title: "Prototype pollution in left-padx",
        url: "https://example.test/advisory/1100001",
        vulnerable_versions: "<2.0.0",
        patched_versions: ">=2.0.0",
        findings: [{ version: "1.4.0", paths: [".>left-padx"] }],
      },
    },
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 },
      dependencies: 1,
      devDependencies: 0,
      optionalDependencies: 0,
      totalDependencies: 1,
    },
  },
  null,
  2,
)}\n`;

// ---- running the binary ----

export type Rec = { kind: string; [key: string]: unknown };
export type Run = { status: number | null; records: Rec[]; stdout: string; stderr: string };

const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";

/** `keel <args> --format=<format>` in `dir`; the env is the process's without vitest and KEEL_* variables, plus `env`. */
export function keelEvidence(
  dir: string,
  args: readonly string[],
  env: Readonly<Record<string, string>> = {},
  format: "json" | "compact" = "json",
): Run {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    clean[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, ...args, `--format=${format}`], {
    cwd: dir,
    encoding: "utf8",
    env: { ...clean, KEEL_SEED: String(SEED), ...env },
  });
  const records: Rec[] = [];
  if (format === "json") {
    for (const line of r.stdout.split("\n")) {
      if (line.trim() === "") continue;
      const v: unknown = JSON.parse(line);
      if (isRec(v)) records.push(v);
    }
  }
  return { status: r.status, records, stdout: r.stdout, stderr: r.stderr };
}

export const diagsOf = (run: Run, code: string): Rec[] =>
  run.records.filter((r) => r.kind === "diag" && r.code === code);

/** A fresh project directory from `tree`; remove it with `rmSync`. */
export const project = (tree: Tree): string => materialize(tree);

/** A new empty directory outside any project, for `--out` targets. */
export const scratch = (): string => mkdtempSync(join(tmpdir(), "keel-evidence-out-"));
export const removeDir = (dir: string): void => rmSync(dir, { recursive: true, force: true });

/**
 * Every regular file under `dir` (relative posix path -> bytes). Symbolic links are not followed and `node_modules`
 * directories are not entered, so a project's own files are read and nothing it links to. A missing `dir` is the empty map.
 */
export function readTree(dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (d: string, prefix: string): void => {
    for (const name of readdirSync(d).sort()) {
      if (name === "node_modules") continue;
      const full = join(d, name);
      const rel = prefix === "" ? name : `${prefix}/${name}`;
      const st = lstatSync(full);
      if (st.isDirectory()) walk(full, rel);
      else if (st.isFile()) out.set(rel, readFileSync(full));
    }
  };
  try {
    lstatSync(dir);
  } catch {
    return new Map();
  }
  walk(dir, "");
  return out;
}

/** Copies a bundle directory to a new scratch directory and returns the copy. */
export function copyBundle(from: string): string {
  const to = join(scratch(), "bundle");
  cpSync(from, to, { recursive: true });
  return to;
}

/** `keel evidence` with `KEEL_EVIDENCE_KEY=pem` into a new `out` under a scratch directory. */
export function writeBundle(
  dir: string,
  pem: string,
  extraArgs: readonly string[] = [],
): { out: string; base: string; run: Run } {
  const base = scratch();
  const out = join(base, "bundle");
  const run = keelEvidence(dir, ["evidence", "--out", out, ...extraArgs], { KEEL_EVIDENCE_KEY: pem });
  return { out, base, run };
}

// ---- reading a bundle ----

export function parseJson(bytes: Buffer | undefined): unknown {
  if (bytes === undefined) throw new Error("file missing from the bundle");
  return JSON.parse(bytes.toString("utf8"));
}

/** Every object anywhere in `value` that has all of `keys`. */
export function collect(value: unknown, keys: readonly string[]): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
      return;
    }
    if (typeof v !== "object" || v === null) return;
    const rec: Record<string, unknown> = Object.fromEntries(Object.entries(v));
    if (keys.every((k) => k in rec)) found.push(rec);
    for (const x of Object.values(rec)) visit(x);
  };
  visit(value);
  return found;
}

/** A path as one dotted string whether the file writes `a.*.b` or `["a","*","b"]`. */
export const pathText = (p: unknown): string => (Array.isArray(p) ? p.map(String).join(".") : String(p));

/** The manifest's `files` count whether it is a number or a list. */
export const countOf = (files: unknown): number => (Array.isArray(files) ? files.length : Number(files));

/** The numbers directly under an object (a `runs` value). */
export function numbersIn(value: unknown): number[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).filter((v): v is number => typeof v === "number");
}

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
