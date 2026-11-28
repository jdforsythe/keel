// Spec: k.library-pages, clause "In that project, with `\"./contract\": \"./dist/status.contract.js\"`, or `\"./src/index.ts\"`, the call in `src/status.contract.ts` is one E1513, message `contract() belongs in a src/*.contract.ts file, not dist/status.contract.js`, or `not src/index.ts`."
// Seed 1337 (no generated input: the two targets are the clause's).
// ASSUMPTIONS (spec silent): "that project" is the project of the preceding bullet (contract-E1513-library.test.ts), its `./contract` export written as the plain string the clause gives; the call is the one `src/status.contract.ts` holds there, exported as `status`;
// the diagnostic is at `node_modules/@acme/status/src/status.contract.ts`; each case asserts the E1513 diagnostics alone.
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";

const NO_TYPES = { types: false } as const;
const ROOT = "node_modules/@acme/status";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const HEAD = "import { contract } from '@keel/router/contract'\n";
const call = (id: string): string => `contract('${id}', { '${id}.home': { path: '/${id}' } })`;
const own = `${HEAD}export const status = ${call("status")}\n`;

/** The project of the bullet: `modules/shop` lists `@acme/status`, the library's `exports` hold `./contract` as `target`. */
function project(target: string): Files {
  return [
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
          "./contract": target,
        },
      }),
    },
    { path: `${ROOT}/index.js`, source: "export {}\n" },
    manifestFile({ id: "status", deps: [], exports: [] }, ROOT),
    { path: `${ROOT}/src/index.ts`, source: "export {}\n" },
    { path: `${ROOT}/src/status.contract.ts`, source: own },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  ];
}
const e1513 = (target: string) => check(project(target), NO_TYPES).diagnostics.filter((d) => d.code === "E1513");

describe("a library whose ./contract export names another kind of file refuses the call in src/status.contract.ts", () => {
  test('with `"./contract": "./dist/status.contract.js"`, the call in `src/status.contract.ts` is one E1513', () => {
    const d = e1513("./dist/status.contract.js");
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe(`${ROOT}/src/status.contract.ts`);
  });

  test("that E1513 reads `contract() belongs in a src/*.contract.ts file, not dist/status.contract.js`", () => {
    expect(e1513("./dist/status.contract.js").map((d) => d.message)).toEqual([
      "contract() belongs in a src/*.contract.ts file, not dist/status.contract.js",
    ]);
  });

  test('with `"./contract": "./src/index.ts"`, the call in `src/status.contract.ts` is one E1513', () => {
    const d = e1513("./src/index.ts");
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe(`${ROOT}/src/status.contract.ts`);
  });

  test("that E1513 reads `contract() belongs in a src/*.contract.ts file, not src/index.ts`", () => {
    expect(e1513("./src/index.ts").map((d) => d.message)).toEqual([
      "contract() belongs in a src/*.contract.ts file, not src/index.ts",
    ]);
  });
});
