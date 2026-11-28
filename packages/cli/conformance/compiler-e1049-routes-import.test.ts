// Spec: k.compiler, clause "A `routes.ts` whose first line imports `./missing.ts`, a file that does not exist, makes `keel check` report one E1049 at that `routes.ts` line 1, whose compact record is followed by the line `see: keel docs k.compiler`."
// Seed 1337 (recorded) for the property: the line the failing import sits on (the clause's line 1 is its first draw), 4 runs, one `keel check` each.
// The real `keel` binary over a temp project (OS tmpdir): module `m` with one page route, as moduleFiles of a11y-project-support.ts, its `routes.ts` given a failing import ahead of its own text.
// ASSUMED: the compact diagnostic record is `E1049 <path>:<line>:<col> <message>` with `<path>` ending `modules/m/routes.ts` (the file's path from the project), and the `see` line is the next line of stdout, printed as docs/OUTPUT.md states for compact (`see: keel docs <id>`, indented two spaces under its record as the `fix` and `see` lines of a diagnostic are).
import { rmSync } from "node:fs";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { keelProject, moduleFiles } from "./a11y-project-support.ts";
import { SEED, keel, put } from "./derived-support.ts";

const SLOW = fixedTime(600_000);
const SEE = "  see: keel docs k.compiler";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A project whose `routes.ts` holds the import of `./missing.ts` on line `at` (lines before it are comments). */
function project(at: number, name = "missing"): string {
  const files = moduleFiles(["r"], false);
  const own = files["modules/m/routes.ts"] ?? "";
  const dir = keelProject("e1049", { ...files });
  dirs.push(dir);
  const head = Array.from({ length: at - 1 }, (_, i) => `// line ${String(i + 1)}\n`).join("");
  put(dir, "modules/m/routes.ts", `${head}import "./${name}.ts";\n${own}`);
  return dir;
}

type Hit = { line: number; col: number; next: string; all: string[] };
/** The E1049 records of a compact run: their `routes.ts` line and column, and the stdout line that follows each. */
function e1049(dir: string): { hits: Hit[]; status: number | null } {
  const out = keel(dir, ["check", "--format=compact"]);
  const lines = out.stdout.split("\n");
  const hits: Hit[] = [];
  lines.forEach((l, i) => {
    const m = /^E1049 (\S+?):(\d+):(\d+) /.exec(l);
    if (m === null || !(m[1] ?? "").endsWith("modules/m/routes.ts")) return;
    hits.push({ line: Number(m[2]), col: Number(m[3]), next: lines[i + 1] ?? "", all: lines });
  });
  return { hits, status: out.status };
}

describe("k.compiler: E1049 from build-time evaluation", () => {
  test(
    "A `routes.ts` whose first line imports `./missing.ts`, a file that does not exist, makes `keel check` report one E1049 at that `routes.ts` line 1",
    () => {
      const dir = project(1);
      const { hits, status } = e1049(dir);
      expect(hits.map((h) => h.line)).toEqual([1]);
      expect(status).toBe(1);
    },
    SLOW,
  );

  test(
    "the compact record of that E1049 is followed by the line `see: keel docs k.compiler`",
    () => {
      const dir = project(1);
      const { hits } = e1049(dir);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.next).toBe(SEE);
    },
    SLOW,
  );

  test(
    "for any line the failing import sits on, the E1049 is at that line of `routes.ts` and followed by the `see` line (property, seed 1337)",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (at) => {
          const { hits } = e1049(project(at));
          expect(hits.map((h) => h.line)).toEqual([at]);
          expect(hits[0]?.next).toBe(SEE);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    SLOW,
  );
});
