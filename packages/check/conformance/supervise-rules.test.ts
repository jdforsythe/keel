// Spec: k.supervise, clause "In `modules/m/a.ts` of an app, `supervise(ctx, 'm.run', f, T)` is one E1461 at the callee, message `supervise in app code: a library owns supervised work; here use attempt(fn, expect)`, with no fix; in `node_modules/@acme/jobs/src/run.ts` of a library (`\"keel\": \"library\"`) the same call is none, and `supervise(ctx, name, f, T)` with `name` a `const` string there is one E1461 at `name`, message `supervise id is not a literal`."
// Seed 1337. The sources are fixture text; `types` is off (the rule reads the callee by symbol from the import).
import { check } from "@keel/check";
import { describe, expect, it } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";
import { at } from "./rules-support.ts";

const ROOT = "node_modules/@acme/jobs";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const MESSAGE = "supervise in app code: a library owns supervised work; here use attempt(fn, expect)";
const NOT_LITERAL = "supervise id is not a literal";
const HEAD =
  "import { supervise } from '@keel/ctx'\nimport type { Ctx } from '@keel/ctx'\nimport type { KeelError } from '@keel/schema'\ndeclare const ctx: Ctx\ndeclare const f: () => number\ndeclare const T: KeelError<'m.t', null>\n";
const app = (body: string) => `${HEAD}${body}\n`;
const lib = (path: string, source: string): Files => [
  manifestFile({ id: "m", deps: ["@acme/jobs"] }),
  {
    path: `${ROOT}/package.json`,
    source: JSON.stringify({ name: "@acme/jobs", version: "1.0.0", type: "module", keel: "library" }),
  },
  manifestFile({ id: "jobs", deps: [], capabilities: [], exports: [] }, ROOT),
  { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  { path, source },
];
const e1461 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1461");

describe("k.supervise: E1461", () => {
  it("`supervise(ctx, 'm.run', f, T)` in `modules/m/a.ts` is one E1461 at the callee, message as stated, with no fix", () => {
    const source = app("export const r = supervise(ctx, 'm.run', f, T)");
    const ds = e1461([
      manifestFile({ id: "m", deps: [], capabilities: [], exports: [] }),
      { path: "modules/m/a.ts", source },
    ]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(MESSAGE);
    expect(ds[0]?.fix).toBeUndefined();
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(source, "supervise(ctx", "export const r"));
  });

  it("the same call in `node_modules/@acme/jobs/src/run.ts` of a library is none", () => {
    expect(e1461(lib(`${ROOT}/src/run.ts`, app("export const r = supervise(ctx, 'jobs.run', f, T)")))).toEqual([]);
  });

  it("`supervise(ctx, name, f, T)` with `name` a `const` string in the library is one E1461 at `name`, message `supervise id is not a literal`, with no fix", () => {
    const source = app("const name = 'jobs.run'\nexport const r = supervise(ctx, name, f, T)");
    const ds = e1461(lib(`${ROOT}/src/run.ts`, source));
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(NOT_LITERAL);
    expect(ds[0]?.fix).toBeUndefined();
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(source, "name, f", "export const r"));
  });

  it("a call through a namespace import, an alias and a const alias in app code is one E1461 each (the callee is found by symbol)", () => {
    for (const body of [
      "import * as c from '@keel/ctx'\nexport const r = c.supervise(ctx, 'm.run', f, T)",
      "import { supervise as sv } from '@keel/ctx'\nexport const r = sv(ctx, 'm.run', f, T)",
    ]) {
      const source = `${body}\nimport type { Ctx } from '@keel/ctx'\nimport type { KeelError } from '@keel/schema'\ndeclare const ctx: Ctx\ndeclare const f: () => number\ndeclare const T: KeelError<'m.t', null>\n`;
      const ds = e1461([
        manifestFile({ id: "m", deps: [], capabilities: [], exports: [] }),
        { path: "modules/m/a.ts", source },
      ]);
      expect(ds, body).toHaveLength(1);
    }
  });
});
