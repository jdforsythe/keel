// Spec: k.review, clause "Each cell of Loudness, and the opt-in step, holds on a fixture; the exit is 1 exactly when a finding is `fail`, and under `--fail-on warn` also when one is `warn`."
// Seed: n/a (the table is finite).
// Per row one escape in a clean project: three commits give `new` (0..1) and `changed` (1..2); two give `standing` (the
// escape's line moved). Loudness: critical fail fail fail; high fail fail warn; medium warn warn list; low list list list;
// an opt-in is one step quieter (`fail` is `warn`, `warn` is `list`), so the high workaround and the high opt-in differ
// by one step in each column, and so do the medium pair.
import { expect, test } from "vitest";
import {
  type Out,
  PROJECT,
  type Repo,
  type Tree,
  findings,
  fixture,
  ofCode,
  range,
  review,
  withRepo,
} from "./review-support.ts";

type Row = {
  name: string;
  code: string;
  danger: string;
  opt: boolean;
  path: string;
  text: string;
  edit: (text: string) => string;
  loud: readonly [string, string, string]; // new, changed, standing
};

const ORIGIN = 'export default { web: { origins: { img: { "https://img.cdn.example": "photos" } } } };\n';
const UNSAFE = 'import { unsafe } from "@keel/ctx";\nexport const v = unsafe("a reason long enough", () => 1);\n';
const rows: readonly Row[] = [
  {
    name: "critical workaround",
    code: "R1053",
    danger: "critical",
    opt: false,
    path: "modules/m/i.ts",
    text: fixture("import-computed.ts"),
    edit: (t) => t.replaceAll("name", "title"),
    loud: ["fail", "fail", "fail"],
  },
  {
    name: "high workaround",
    code: "R1057",
    danger: "high",
    opt: false,
    path: "modules/m/s.test.ts",
    text: fixture("env.ts"),
    edit: (t) => t.replace("KEEL_FIXTURE", "KEEL_OTHER"),
    loud: ["fail", "fail", "warn"],
  },
  {
    name: "medium workaround",
    code: "R1050",
    danger: "medium",
    opt: false,
    path: "modules/m/c.test.ts",
    text: fixture("cast.ts"),
    edit: () => fixture("cast-edited.ts"),
    loud: ["warn", "warn", "list"],
  },
  {
    name: "low opt-in",
    code: "R1010",
    danger: "low",
    opt: true,
    path: "topology.ts",
    text: ORIGIN,
    edit: (t) => t.replace("photos", "pictures"),
    loud: ["list", "list", "list"],
  },
  {
    name: "medium opt-in",
    code: "R1001",
    danger: "medium",
    opt: true,
    path: "modules/m/u.ts",
    text: UNSAFE,
    edit: (t) => t.replace("long enough", "also long enough"),
    loud: ["list", "list", "list"],
  },
  {
    name: "high opt-in",
    code: "R1012",
    danger: "high",
    opt: true,
    path: "modules/m/a.server.ts",
    text: "export const t = reveal(token);\n",
    edit: (t) => t.replace("token", "secret"),
    loud: ["warn", "warn", "list"],
  },
];

const expectedExit = (out: Out, failOnWarn: boolean): number =>
  findings(out).some((f) => f.loud === "fail" || (failOnWarn && f.loud === "warn")) ? 1 : 0;

/** The row's loudness in a range; both exits are checked against all the run's findings. */
function cell(repo: Repo, from: number, to: number, row: Row): string | undefined {
  const r = range(repo, from, to);
  const out = review(repo, [r, "--list"]);
  const plain = review(repo, [r]);
  expect(plain.status, plain.stderr + plain.stdout).toBe(expectedExit(out, false));
  const strict = review(repo, [r, "--fail-on", "warn"]);
  expect(strict.status, strict.stderr + strict.stdout).toBe(expectedExit(out, true));
  const hits = ofCode(out, row.code);
  expect(hits, `${row.name} ${row.code} ${r}: ${out.stderr}${out.stdout}`).toHaveLength(1);
  expect(hits[0]?.danger).toBe(row.danger);
  expect(hits[0]?.opt).toBe(row.opt);
  return hits[0]?.loud;
}

/**
 * What the Loudness case bounds: for each of the six rows, three cells of three `keel review` runs each, 54 runs and
 * their fixture repositories, about 0.2 s a run here alone and up to 0.5 s beside the suite's other work. The bound is
 * 10 s a run, so a runner ten times slower (scale 0.1) still has 1 s a run, twice the loaded time.
 */
const LOUDNESS_BOUND = 6 * 3 * 3 * 10_000;

test(
  "Each cell of Loudness, and the opt-in step, holds on a fixture; the exit is 1 exactly when a finding is `fail`, and under `--fail-on warn` also when one is `warn`.",
  () => {
    for (const row of rows) {
      const put = (text: string): Tree => ({ [row.path]: text });
      withRepo([PROJECT, put(row.text), put(row.edit(row.text))], (repo) => {
        expect(cell(repo, 0, 1, row), `${row.name}: new`).toBe(row.loud[0]);
        expect(cell(repo, 1, 2, row), `${row.name}: changed`).toBe(row.loud[1]);
      });
      withRepo([{ ...PROJECT, ...put(row.text) }, put(`\n${row.text}`)], (repo) => {
        expect(cell(repo, 0, 1, row), `${row.name}: standing`).toBe(row.loud[2]);
      });
    }
  },
  LOUDNESS_BOUND,
);
