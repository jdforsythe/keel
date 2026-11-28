// Spec: k.library-pages, clause "In a project whose `modules/shop/module.ts` lists `'@acme/status'`, a library (`module.ts` `id: 'status'`) whose `exports` hold `\"./contract\": { \"keel\": \"./src/status.contract.ts\" }`: `contract('status', ...)` exported as `status` there is no E1513; the same call in `src/other.contract.ts` beside it is one E1513 at `node_modules/@acme/status/src/other.contract.ts`, message `contract() belongs in src/status.contract.ts`; with no `./contract` entry, the call in `src/status.contract.ts` is one E1513, message `contract() belongs in the file a ./contract export names`; a second call there, `contract('shop', ...)` and an export named `page` are each one E1513, messages `a second contract() call; src/status.contract.ts holds one`, `contract id must be 'status', the module of src/status.contract.ts` and ``export the contract as `status` from src/status.contract.ts``."
// Seed: 1337 (the property over file names); every other case is an example.
// ASSUMPTIONS (spec silent): `check()` is given the library's files at `node_modules/@acme/status/...` with `package.json`, `module.ts` and a ledger file, as library-rules.test.ts does;
// a diagnostic's message is the whole message the bullet quotes; "a second call there" is a second, unexported `contract('status', ...)` in `src/status.contract.ts`;
// "an export named `page`" is `export const page = contract('status', ...)` and `contract('shop', ...)` is exported as `status`; each case asserts the E1513 diagnostics alone.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { type Files, SEED, manifestFile } from "./module-support.ts";

const NO_TYPES = { types: false } as const;
const ROOT = "node_modules/@acme/status";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const HEAD = "import { contract } from '@keel/router/contract'\n";
const call = (id: string): string => `contract('${id}', { '${id}.home': { path: '/${id}' } })`;
const own = `${HEAD}export const status = ${call("status")}\n`;

/** The project of the bullet: `modules/shop` lists `@acme/status`, the library's `exports` hold `./contract` unless `contractEntry` is false; `extra` adds or replaces files by path. */
function project(extra: Files = [], contractEntry = true): Files {
  const base: Files = [
    manifestFile({ id: "shop", deps: ["@acme/status"] }),
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({
        name: "@acme/status",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: {
          ".": { keel: "./src/index.ts", default: "./index.js" },
          ...(contractEntry ? { "./contract": { keel: "./src/status.contract.ts" } } : {}),
        },
      }),
    },
    { path: `${ROOT}/index.js`, source: "export {}\n" },
    manifestFile({ id: "status", deps: [], exports: [] }, ROOT),
    { path: `${ROOT}/src/index.ts`, source: "export {}\n" },
    { path: `${ROOT}/src/status.contract.ts`, source: own },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  ];
  const paths = new Set(extra.map((x) => x.path));
  return [...base.filter((b) => !paths.has(b.path)), ...extra];
}
const lib = (rel: string, source: string) => ({ path: `${ROOT}/${rel}`, source });
const e1513 = (files: Files) => check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1513");

describe("a library's contract() belongs in the file its ./contract export names", () => {
  test("`contract('status', ...)` exported as `status` in `src/status.contract.ts`, the file `./contract` names, is no E1513", () => {
    expect(e1513(project())).toEqual([]);
  });

  test("the same call in `src/other.contract.ts` beside it is one E1513 at `node_modules/@acme/status/src/other.contract.ts`", () => {
    const d = e1513(project([lib("src/other.contract.ts", own)]));
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe(`${ROOT}/src/other.contract.ts`);
  });

  test("that E1513 reads `contract() belongs in src/status.contract.ts`", () => {
    const d = e1513(project([lib("src/other.contract.ts", own)]));
    expect(d.map((x) => x.message)).toEqual(["contract() belongs in src/status.contract.ts"]);
  });

  test(
    "a `contract()` call in any other file of the library is one E1513 at that file naming `src/status.contract.ts`, whatever its name",
    () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{3,8}$/),
          fc.constantFrom("contract.ts", "ts", "helpers.ts"),
          (stem, kind) => {
            const name = kind === "ts" ? `${stem}x.ts` : kind === "helpers.ts" ? `${stem}.ts` : `${stem}.${kind}`;
            const rel = `src/${name}`;
            fc.pre(rel !== "src/status.contract.ts" && rel !== "src/index.ts");
            const d = e1513(project([lib(rel, own)]));
            expect(d.length).toBe(1);
            expect(d[0]?.path).toBe(`${ROOT}/${rel}`);
            expect(d[0]?.message).toBe("contract() belongs in src/status.contract.ts");
          },
        ),
        { seed: SEED, numRuns: 20 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test("with no `./contract` entry, the call in `src/status.contract.ts` is one E1513", () => {
    const d = e1513(project([], false));
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe(`${ROOT}/src/status.contract.ts`);
  });

  test("with no `./contract` entry, that E1513 reads `contract() belongs in the file a ./contract export names`", () => {
    expect(e1513(project([], false)).map((d) => d.message)).toEqual([
      "contract() belongs in the file a ./contract export names",
    ]);
  });
});

describe("in the `./contract` file, a second call, another id and another export name are each one E1513", () => {
  const inFile = (source: string) => e1513(project([lib("src/status.contract.ts", source)]));

  test("a second call there is one E1513", () => {
    const d = inFile(`${own}const again = ${call("status")}\nvoid again\n`);
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe(`${ROOT}/src/status.contract.ts`);
  });

  test("that E1513 reads `a second contract() call; src/status.contract.ts holds one`", () => {
    const d = inFile(`${own}const again = ${call("status")}\nvoid again\n`);
    expect(d.map((x) => x.message)).toEqual(["a second contract() call; src/status.contract.ts holds one"]);
  });

  test("`contract('shop', ...)` there is one E1513", () => {
    const d = inFile(`${HEAD}export const status = ${call("shop")}\n`);
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe(`${ROOT}/src/status.contract.ts`);
  });

  test("that E1513 reads `contract id must be 'status', the module of src/status.contract.ts`", () => {
    const d = inFile(`${HEAD}export const status = ${call("shop")}\n`);
    expect(d.map((x) => x.message)).toEqual(["contract id must be 'status', the module of src/status.contract.ts"]);
  });

  test("an export named `page` there is one E1513", () => {
    const d = inFile(`${HEAD}export const page = ${call("status")}\n`);
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe(`${ROOT}/src/status.contract.ts`);
  });

  test("that E1513 reads ``export the contract as `status` from src/status.contract.ts``", () => {
    const d = inFile(`${HEAD}export const page = ${call("status")}\n`);
    expect(d.map((x) => x.message)).toEqual(["export the contract as `status` from src/status.contract.ts"]);
  });

  test(
    "any export name but `status` is one E1513 naming the export, whatever the name",
    () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[a-z]{3,8}$/), (name) => {
          fc.pre(name !== "status");
          const d = e1513(
            project([lib("src/status.contract.ts", `${HEAD}export const ${name} = ${call("status")}\n`)]),
          );
          expect(d.map((x) => x.message)).toEqual(["export the contract as `status` from src/status.contract.ts"]);
        }),
        { seed: SEED, numRuns: 20 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
