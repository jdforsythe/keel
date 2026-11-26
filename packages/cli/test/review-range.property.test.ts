// keel review over git ranges, in process (k.review Novelty, Baseline; k.escapes Range codes): the range codes read
// from changes, and the property that a baseline entry added in the head commit never lowers the loudness of that
// commit's findings. Each case builds a small repository in the OS temp directory; nothing reaches a network. Seed 1337.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { rangeEscapes } from "../src/review/rangeEscapes.ts";
import { reviewCommand } from "../src/review/reviewCommand.ts";
import type { OutRecord } from "../src/types/OutRecord.ts";

const SEED = 1337;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const git = (cwd: string, ...args: string[]): string => {
  const r = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.test", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } },
  );
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
type Tree = Readonly<Record<string, string | null>>;
function repo(commits: readonly Tree[]): { dir: string; shas: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "keel-review-unit-"));
  dirs.push(dir);
  git(dir, "init", "-q", "-b", "main");
  const shas: string[] = [];
  for (const tree of commits) {
    for (const [p, t] of Object.entries(tree)) {
      if (t === null) rmSync(join(dir, p), { force: true });
      else {
        mkdirSync(dirname(join(dir, p)), { recursive: true });
        writeFileSync(join(dir, p), t);
      }
    }
    git(dir, "add", "-A", "-f");
    git(dir, "commit", "-q", "--allow-empty", "-m", "c");
    shas.push(git(dir, "rev-parse", "HEAD"));
  }
  return { dir, shas };
}
type Finding = { code: string; id: string; loud: string; novelty: string; path: string };
const isFinding = (r: OutRecord): r is OutRecord & Finding =>
  r.kind === "review" && typeof r.id === "string" && typeof r.loud === "string" && typeof r.code === "string";
async function review(dir: string, words: string[], list = true): Promise<Finding[]> {
  const out = await reviewCommand({ paths: words, format: "json", list }, { cwd: dir });
  return out.records.filter(isFinding);
}
const PROJECT: Tree = { "topology.ts": "export default {};\n", "package.json": '{"name":"fx"}\n' };

/** Escapes one line each, for files of a generated project. */
const LINES = [
  "export const a1 = 1 as number;\n",
  'export const a2 = unsafe("a reason long enough", () => 2);\n',
  "export const a3 = (n: string) => import(n);\n",
  "export const a4 = process.env.KEY;\n",
  'export const a5 = reveal("x");\n',
];
const FILES = ["modules/m/a.test.ts", "modules/m/b.server.ts", "modules/m/c.ts"];

describe("range codes", () => {
  test("rangeEscapes reads configuration, CI, baseline, generated files, tests and pii calls from the changes", () => {
    const before: Record<string, string> = {
      "tsconfig.json": "{}",
      "package.json": '{"scripts":{"a":"x"}}',
      "m/t.test.ts": 'test("a", () => { expect(1).toBe(1); expect(2).toBe(2); });',
      "m/s.ts": 'export const f = [s.string().pii("a"), s.secret(), guard(x)];',
      "m/gone.test.ts": 'test("a", () => {});',
    };
    const after: Record<string, string> = {
      "tsconfig.json": '{"strict":false}',
      "package.json": '{"scripts":{"a":"y"}}',
      "m/t.test.ts": 'test("a", () => { expect(1).toBe(1); });',
      "m/s.ts": "export const f = [s.string()];",
      ".github/workflows/ci.yml": "x",
      "keel-review.json": "{}",
      ".keel/routes.json": "{}",
      "conformance/a.test.ts": "x",
    };
    const changes = [
      { status: "M", path: "tsconfig.json", from: "tsconfig.json" },
      { status: "M", path: "package.json", from: "package.json" },
      { status: "M", path: "m/t.test.ts", from: "m/t.test.ts" },
      { status: "M", path: "m/s.ts", from: "m/s.ts" },
      { status: "D", path: "m/gone.test.ts", from: "m/gone.test.ts" },
      { status: "A", path: ".github/workflows/ci.yml" },
      { status: "A", path: "keel-review.json" },
      { status: "A", path: ".keel/routes.json" },
      { status: "A", path: "conformance/a.test.ts" },
      { status: "R", path: "m/u.test.ts", from: "m/v.test.ts", same: true },
    ] as const;
    const got = rangeEscapes(
      changes,
      (p) => before[p],
      (p) => after[p],
    ).map((f) => `${f.raw.code} ${f.path}`);
    expect(got.sort()).toEqual(
      [
        "R1103 tsconfig.json",
        "R1103 package.json",
        "R1060 m/t.test.ts",
        "R1108 m/s.ts",
        "R1108 m/s.ts",
        "R1108 m/s.ts",
        "R1060 m/gone.test.ts",
        "R1104 .github/workflows/ci.yml",
        "R1105 keel-review.json",
        "R1107 .keel/routes.json",
        "R1061 conformance/a.test.ts",
      ].sort(),
    );
  });

  test("R1100 needs both a project's file and a Keel package's; a package named outside @keel/ is neither", async () => {
    const r = repo([
      {
        "package.json": "{}\n",
        "apps/x/topology.ts": "export default {};\n",
        "apps/x/a.ts": "export const a = 1;\n",
        "packages/mine/package.json": '{"name":"mine"}\n',
        "packages/mine/a.ts": "export const m = 1;\n",
        "packages/ui/a.ts": "export const u = 1;\n",
      },
      { "apps/x/a.ts": "export const a = 2;\n", "packages/mine/a.ts": "export const m = 2;\n" },
      { "apps/x/a.ts": "export const a = 3;\n", "packages/ui/a.ts": "export const u = 2;\n" },
    ]);
    const codes = async (a: number, b: number): Promise<string[]> =>
      (await review(r.dir, [`${r.shas[a]}..${r.shas[b]}`])).map((f) => f.code);
    expect(await codes(0, 1)).not.toContain("R1100");
    expect(await codes(1, 2)).toContain("R1100");
  });
});

describe("baseline", () => {
  test(
    "an entry added to the baseline in the head commit never lowers the loudness of that commit's findings",
    async () => {
      const tree = fc.record({
        base: fc.array(fc.tuple(fc.constantFrom(...FILES), fc.constantFrom(...LINES)), { maxLength: 4 }),
        head: fc.array(fc.tuple(fc.constantFrom(...FILES), fc.constantFrom(...LINES)), { minLength: 1, maxLength: 4 }),
        pick: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
      });
      const text = (rows: readonly (readonly [string, string])[]): Record<string, string> => {
        const out: Record<string, string> = {};
        for (const [f, l] of rows) out[f] = `${out[f] ?? ""}${l}`;
        return out;
      };
      await fc.assert(
        fc.asyncProperty(tree, async ({ base, head, pick }) => {
          const first = repo([{ ...PROJECT, ...text(base) }, text([...base, ...head])]);
          const range = `${first.shas[0]}..${first.shas[1]}`;
          const plain = await review(first.dir, [range]);
          const chosen = plain.filter((f, i) => pick[i % pick.length] === true && f.code !== "R1105");
          const entries = chosen.map((f) => ({
            id: f.id,
            code: f.code,
            path: f.path,
            reason: "accepted in the head commit",
          }));
          const second = repo([
            { ...PROJECT, ...text(base) },
            { ...text([...base, ...head]), "keel-review.json": `${JSON.stringify({ v: 1, accepted: entries })}\n` },
          ]);
          const withEntry = await review(second.dir, [`${second.shas[0]}..${second.shas[1]}`]);
          for (const f of plain) {
            const same = withEntry.find((g) => g.id === f.id);
            expect(same?.loud, `${f.code} ${f.path}`).toBe(f.loud);
          }
          expect(withEntry.some((g) => g.code === "R1105" && g.loud === "fail")).toBe(true);
        }),
        { seed: SEED, numRuns: 8 },
      );
    },
    fixedTime(120_000),
  );

  test("--accept writes the entry the next review of the tree reads as accepted", async () => {
    const r = repo([{ ...PROJECT, "modules/m/c.test.ts": "export const n = 1 as number;\n" }]);
    const [cast] = await review(r.dir, []);
    expect(cast?.code).toBe("R1050");
    const out = await reviewCommand(
      { accept: cast?.id ?? "", reason: "the fixture's cast is accepted" },
      { cwd: r.dir },
    );
    expect(out.writes.map((w) => w.path)).toEqual(["keel-review.json"]);
    const written = out.writes[0]?.content ?? "";
    expect(JSON.parse(written)).toEqual({
      v: 1,
      accepted: [
        { id: cast?.id, code: "R1050", path: "modules/m/c.test.ts", reason: "the fixture's cast is accepted" },
      ],
    });
  });
});
