// One fixture per code of k.escapes for the `keel review` conformance tests. Not a test file.
// Every case is two commits: a base tree and a head tree whose files override the base's; the clean twin shares the
// base and changes only `modules/m/a.ts`. ASSUMED syntax where the spec names only the construct: `origins` as a
// literal in `topology.ts`, `createApp({ allow })`, an `identity` option holding `handle`, a `reveal(...)` call.
import { PROJECT, type Tree, fixture } from "./review-support.ts";

export type Case = { code: string; base: Tree; head: Tree; range: boolean };

const PII2 = 'export const f = [s.string().pii("a"), s.string().pii("b")];\n';
const PII1 = 'export const f = [s.string().pii("a"), s.string()];\n';
const LOCK = (resolution: string): string =>
  `lockfileVersion: '9.0'\npackages:\n  left-pad@1.0.0:\n    resolution: ${resolution}\n`;

export const HARMLESS: Tree = { "modules/m/a.ts": "export const a = 2;\n" };
export const BASE_PROJECT: Tree = PROJECT;

const entry = { id: "0123456789ab", code: "R1050", path: "modules/m/a.ts", reason: "an accepted cast in the fixture" };

export const CASES: readonly Case[] = [
  {
    code: "R1001",
    range: false,
    base: {},
    head: {
      "modules/m/u.ts":
        'import { unsafe } from "@keel/ctx";\nexport const v = unsafe("a reason long enough", () => 1);\n',
    },
  },
  {
    code: "R1010",
    range: false,
    base: {},
    head: { "topology.ts": 'export default { web: { origins: { img: { "https://img.cdn.example": "photos" } } } };\n' },
  },
  {
    code: "R1011",
    range: false,
    base: {},
    head: { "modules/m/app.server.ts": 'createApp({ allow: ["https://a.example"] });\n' },
  },
  { code: "R1012", range: false, base: {}, head: { "modules/m/a.server.ts": "export const t = reveal(token);\n" } },
  {
    code: "R1013",
    range: false,
    base: {},
    head: {
      "modules/m/r.ts":
        'import { defect } from "@keel/schema";\ndeclare const r: { ok: boolean; value: number };\nexport const v = r.ok ? r.value : defect("x");\n',
    },
  },
  {
    code: "R1015",
    range: false,
    base: {},
    head: {
      "modules/m/p.ts":
        "type T = number;\nexport function isT(x: unknown): x is T {\n  return typeof x === 'number';\n}\n",
    },
  },
  {
    code: "R1017",
    range: false,
    base: {},
    head: {
      "modules/m/r.ts":
        "import { attempt } from '@keel/schema';\ndeclare const f: () => number;\ndeclare const T: { code: 'm.t'; message: string; data: null };\nexport const r = attempt(f, (x) => (x instanceof Error ? T : undefined));\n",
    },
  },
  {
    code: "R1014",
    range: false,
    base: {},
    head: { "modules/m/app.server.ts": 'createApp({ identity: { handle: { path: "/auth", fn: authFn } } });\n' },
  },
  { code: "R1050", range: false, base: {}, head: { "modules/m/c.test.ts": fixture("cast.ts") } },
  { code: "R1051", range: false, base: {}, head: { "modules/m/d.ts": fixture("disable-comments.ts") } },
  { code: "R1052", range: false, base: {}, head: { "modules/m/f.ts": fixture("folded-directives.ts") } },
  { code: "R1053", range: false, base: {}, head: { "modules/m/i.ts": fixture("import-computed.ts") } },
  {
    code: "R1055",
    range: false,
    base: {},
    head: { "modules/m/k.ts": 'import { x } from "@keel/compiler/src/a.ts";\nexport const y = x;\n' },
  },
  { code: "R1056", range: false, base: {}, head: { "modules/m/g.ts": fixture("computed-global.ts") } },
  { code: "R1057", range: false, base: {}, head: { "modules/m/s.server.ts": fixture("env.ts") } },
  { code: "R1058", range: false, base: {}, head: { "modules/m/unsafe/n.ts": "export const n = 1;\n" } },
  { code: "R1059", range: false, base: {}, head: { "modules/m/t.test.ts": fixture("test-only.ts") } },
  {
    code: "R1060",
    range: true,
    base: { "modules/m/t.test.ts": fixture("test-two-expects.ts") },
    head: { "modules/m/t.test.ts": fixture("test-plain.ts") },
  },
  {
    code: "R1061",
    range: true,
    base: { "modules/m/conformance/c.test.ts": fixture("test-plain.ts") },
    head: { "modules/m/conformance/c.test.ts": fixture("test-two-expects.ts") },
  },
  {
    code: "R1100",
    range: true,
    base: { "packages/compiler/src/a.ts": "export const c = 1;\n" },
    head: { "packages/compiler/src/a.ts": "export const c = 2;\n", "modules/m/a.ts": "export const a = 2;\n" },
  },
  {
    code: "R1101",
    range: false,
    base: {},
    head: {
      "package.json": `${JSON.stringify({ name: "fx", private: true, pnpm: { overrides: { "left-pad": "1.0.0" } } })}\n`,
    },
  },
  {
    code: "R1102",
    range: false,
    base: {},
    head: {
      "package.json": `${JSON.stringify({ name: "fx", private: true, scripts: { postinstall: "node setup.js" } })}\n`,
    },
  },
  {
    code: "R1103",
    range: true,
    base: { "tsconfig.json": "{}\n" },
    head: { "tsconfig.json": '{"compilerOptions":{"strict":false}}\n' },
  },
  {
    code: "R1104",
    range: true,
    base: { ".github/workflows/ci.yml": "name: ci\n" },
    head: { ".github/workflows/ci.yml": "name: ci2\n" },
  },
  { code: "R1105", range: true, base: {}, head: { "keel-review.json": '{"v":1,"accepted":[]}\n' } },
  { code: "R1107", range: true, base: { ".keel/x.json": "{}\n" }, head: { ".keel/x.json": '{"a":1}\n' } },
  { code: "R1108", range: true, base: { "modules/m/s.ts": PII2 }, head: { "modules/m/s.ts": PII1 } },
  {
    code: "R2451",
    range: false,
    base: {},
    head: {
      "modules/m/db.server.ts":
        'export const f = (db: Db) => db.transaction(async () => 1, { allow: "write skew", reason: "audit rows only" });\n',
    },
  },
  { code: "R1150", range: false, base: {}, head: { "modules/m/bad.ts": "export const = ;\n" } },
  {
    code: "R1151",
    range: false,
    base: { "keel-review.json": `${JSON.stringify({ v: 1, accepted: [entry] })}\n` },
    head: HARMLESS,
  },
];

/** A twin's base: the case's base, except for the codes whose twin must not hold the base's trigger. */
export const cleanBase = (c: Case): Tree => (c.code === "R1151" ? {} : c.base);
export { LOCK };
