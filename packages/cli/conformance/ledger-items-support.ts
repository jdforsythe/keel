// Support for the k.ledger-items conformance files (not a test file): the clause key, a spec section and a citing file
// as text, run reports as text, and the real `keel` binary over a temp project (test-sim-project.ts). Property seed: 1337.
// ASSUMED (the spec names no fixture layout): a spec section is `spec/kernel/<id>.md` of the project, as ledger-range-clause.test.ts
// writes it; a package `p` is `packages/p` with a `package.json`; a conformance file cites its section with one trivial test.
import { createHash } from "node:crypto";
import { type CliRecord, type Run, keel, makeProject, removeProject } from "./test-sim-project.ts";

export const SEED = 1337;
export const SLOW = 120_000;

/** k.ledger-items Clause key: the normal form of a bullet's text, the key of its item and the item. */
export function normalForm(text: string): string {
  const straight = text
    .replaceAll("`", "")
    .replaceAll('\\"', '"')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'");
  const lower = straight.replace(/\s+/g, " ").trim().toLowerCase();
  return lower.endsWith(".") ? lower.slice(0, -1) : lower;
}
export const keyOf = (text: string): string =>
  createHash("sha256").update(normalForm(text), "utf8").digest("hex").slice(0, 8);
export const itemOf = (section: string, text: string): string => `${section}#${keyOf(text)}`;

export const SPEC_DIR = "spec/kernel";
export const specPath = (section: string): string => `${SPEC_DIR}/${section}.md`;

/** The lines of a spec section as the fixture writes it: the first bullet is line `FIRST_BULLET_LINE` (1-based). */
export const FIRST_BULLET_LINE = 5;
export const specText = (section: string, bullets: readonly string[], status = "implemented"): string =>
  [`# ${section}: Fixture`, `status: ${status}`, "", "**Conformance.**", ...bullets.map((b) => `- ${b}`), ""].join(
    "\n",
  );
/** The 1-based line of the bullet at 1-based position `n` in `specText`. */
export const bulletLine = (n: number): number => FIRST_BULLET_LINE + n - 1;

/** A conformance file: `header` lines, one import, then one passing test (`it.skip` when `skip`); its call spans `testLine` to `endLine`. */
export function citingFile(
  header: readonly string[],
  opts: { skip?: boolean; title?: string } = {},
): { source: string; testLine: number; endLine: number } {
  const lines = [
    ...header,
    'import { expect, it } from "vitest";',
    `it${opts.skip === true ? ".skip" : ""}(${JSON.stringify(opts.title ?? "holds")}, () => {`,
    "  expect(1 + 1).toBe(2);",
    "});",
    "",
  ];
  return { source: lines.join("\n"), testLine: header.length + 2, endLine: header.length + 4 };
}
/** `// Spec: <section>, clause "<quote>"` with the quote's inner `"` written `\"`. */
export const citeLine = (section: string, quote: string, note = ""): string =>
  `// Spec: ${section}, clause "${quote.replace(/(?<!\\)"/g, '\\"')}"${note === "" ? "" : ` ${note}`}`;

export const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
export type ReportedTest = { line: number; state: "passed" | "failed" | "skipped" };
/** The text of a run report (k.test-run Run report) over `files`: each a path relative to its project and its source with the tests it ran. */
export const reportText = (
  files: Readonly<Record<string, { source: string; tests: readonly ReportedTest[]; sha?: string | undefined }>>,
): string =>
  `${JSON.stringify(
    {
      v: 1,
      files: Object.fromEntries(
        Object.entries(files).map(([path, f]) => [path, { sha: f.sha ?? sha256(f.source), tests: f.tests }]),
      ),
    },
    null,
    2,
  )}\n`;

export const packageJson = (name: string): string => `${JSON.stringify({ name, private: true }, null, 2)}\n`;

/** `keel ledger` in `dir`, leaving `reports/` as the case made it (no report is written for the fixture). */
export const ledgerAsIs = (dir: string, extra: readonly string[] = []): Run =>
  keel(dir, ["ledger", ...extra], { reports: "none" });

export const diagsOf = (run: Run, code: string): CliRecord[] =>
  run.records.filter((r) => r.kind === "diag" && r.code === code);
export const clauseRecord = (run: Run, item: string): CliRecord | undefined =>
  run.records.find((r) => r.kind === "ledger" && r.item === item);
/** Every clause record (an item `<section>#<key>`) of `section`. */
export const clausesOf = (run: Run, section: string): CliRecord[] =>
  run.records.filter((r) => r.kind === "ledger" && typeof r.item === "string" && r.item.startsWith(`${section}#`));

/** A temp project removed after `body`. */
export function inProject<T>(prefix: string, files: Readonly<Record<string, string>>, body: (dir: string) => T): T {
  const dir = makeProject(prefix, files);
  try {
    return body(dir);
  } finally {
    removeProject(dir);
  }
}
