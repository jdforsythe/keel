// Spec: k.escapes, clause "R1018 is one finding for `supervise(ctx, 'jobs.run', f, T)` in a library's file (a file of a `"keel": "library"` package, k.library); R1019 one for `Symbol.for(name)` with `name` a parameter and none for `Symbol.for('app.key')`; R1020 one each for `window.addEventListener(name, h)` and `process.on(name, h)` with `name` a parameter, and none for `el.addEventListener(name, h)` with `el` an element."
// Spec: k.supervise, clause "`keel review` reports one R1018 for each `supervise` call of a library's file, and none for a file with no such call."
// Spec: k.realm, clause "`keel review` reports one R1019 for `Symbol.for(name)` with `name` a parameter in `modules/m/a.ts`, and none for `Symbol.for('app.key')`."
// k.escapes, Codes "R1018 | medium, opt-in | a `supervise` call (k.supervise)"; "R1019 | critical | a `Symbol.for` call whose argument does not fold to a string (k.realm)"; "R1020 | high | `addEventListener` on `globalThis`, `window` or `self`, or bare, or `process.on`, `once`, `addListener` or `prependListener`, with an event name that is no literal (k.unsafe Other spellings)". The table rows are CASES in review-cases.ts.
// Seed 1337 (no generated input: the forms are source text). Each case writes one repository and reads one review.
// Reading: "a library's file" is a file of a package whose `package.json` has `"keel": "library"` (k.library); the fixture puts them under `src/` of a workspace folder.
import { testTime } from "@keel/tooling/test-time";
import { expect, test } from "vitest";
import { PROJECT, ofCode, range, review, withRepo } from "./review-support.ts";

const LIB = {
  "libs/jobs/package.json": `${JSON.stringify({ name: "@acme/jobs", version: "1.0.0", type: "module", keel: "library" })}\n`,
};
const hits = (tree: Record<string, string>, code: string) =>
  withRepo([PROJECT, tree], (repo) => ofCode(review(repo, [range(repo, 0, 1), "--list"]), code));
const SUPERVISE =
  "import { supervise } from '@keel/ctx';\nimport type { Ctx } from '@keel/ctx';\ndeclare const ctx: Ctx;\ndeclare const f: () => number;\ndeclare const T: { code: 'm.t'; message: string; data: null };\nexport const r = supervise(ctx, 'jobs.run', f, T);\n";

test(
  'R1018 is one finding for `supervise(ctx, \'jobs.run\', f, T)` in a library\'s file (a file of a `"keel": "library"` package, k.library)',
  () => {
    const h = hits({ ...LIB, "libs/jobs/src/run.ts": SUPERVISE }, "R1018");
    expect(h).toHaveLength(1);
    expect(h[0]?.path).toBe("libs/jobs/src/run.ts");
  },
  testTime(120_000),
);

test(
  "`keel review` reports one R1018 for each `supervise` call of a library's file, and none for a file with no such call",
  () => {
    const two = `${SUPERVISE}export const q = supervise(ctx, 'jobs.again', f, T);\n`;
    const h = hits({ ...LIB, "libs/jobs/src/run.ts": two, "libs/jobs/src/plain.ts": "export const p = 1;\n" }, "R1018");
    expect(h.filter((x) => x.path === "libs/jobs/src/run.ts")).toHaveLength(2);
    expect(h.filter((x) => x.path === "libs/jobs/src/plain.ts")).toEqual([]);
  },
  testTime(120_000),
);

test(
  "R1019 is one finding for `Symbol.for(name)` with `name` a parameter, and none for `Symbol.for('app.key')`",
  () => {
    const one = hits({ "modules/m/a.ts": "export const k = (name: string) => Symbol.for(name);\n" }, "R1019");
    expect(one).toHaveLength(1);
    expect(one[0]?.path).toBe("modules/m/a.ts");
    expect(hits({ "modules/m/a.ts": "export const k = Symbol.for('app.key');\n" }, "R1019")).toEqual([]);
  },
  testTime(120_000),
);

test(
  "`keel review` reports one R1019 for `Symbol.for(name)` with `name` a parameter in `modules/m/a.ts`, and none for `Symbol.for('app.key')`",
  () => {
    expect(
      hits({ "modules/m/a.ts": "export function k(name: string) { return Symbol.for(name) }\n" }, "R1019"),
    ).toHaveLength(1);
    expect(hits({ "modules/m/a.ts": "export const k = Symbol.for('app.key');\n" }, "R1019")).toEqual([]);
  },
  testTime(120_000),
);

test(
  "R1020 is one finding each for `window.addEventListener(name, h)` and `process.on(name, h)` with `name` a parameter, and none for `el.addEventListener(name, h)` with `el` an element",
  () => {
    const head = "declare const h: () => void;\n";
    const a = hits(
      { "modules/m/a.ts": `${head}export const f = (name: string) => window.addEventListener(name, h);\n` },
      "R1020",
    );
    const b = hits({ "modules/m/a.ts": `${head}export const f = (name: string) => process.on(name, h);\n` }, "R1020");
    const c = hits(
      {
        "modules/m/a.ts": `${head}declare const el: HTMLElement;\nexport const f = (name: string) => el.addEventListener(name, h);\n`,
      },
      "R1020",
    );
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(c).toEqual([]);
  },
  testTime(120_000),
);
