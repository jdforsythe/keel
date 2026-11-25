// Spec: k.reactive, clause "In a project whose `modules/shop/module.ts` lists `'@acme/charts'` in `deps` and whose `node_modules/@acme/charts/` holds `package.json` `{\"name\":\"@acme/charts\",\"version\":\"1.0.0\",\"type\":\"module\",\"keel\":\"library\"}` and a `module.ts` with `id: 'charts'`, `deps: []`, `capabilities: []` and `public: { exports: [] }`, `scope(() => undefined, { detached: true })` (`scope` from `@keel/reactive`) inside the arrow function given to `unsafe('a scope declared at module level has no owner to nest in', () => ...)` is no E1207 in `node_modules/@acme/charts/unsafe/detached.ts` and one E1207 in `modules/shop/unsafe/detached.ts`; the same call at the top level of `node_modules/@acme/charts/src/plain.ts` is one E1207."
// Seed 1337
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";

const ROOT = "node_modules/@acme/charts";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const CALL = "scope(() => undefined, { detached: true })";
const HEAD = "import { scope } from '@keel/reactive'\n";
const LIFTED = `${HEAD}export const d = unsafe('a scope declared at module level has no owner to nest in', () => ${CALL})\n`;
const TOP = `${HEAD}export const d = ${CALL}\n`;
const project: Files = [
  manifestFile({ id: "shop", deps: ["@acme/charts"] }),
  {
    path: `${ROOT}/package.json`,
    source: JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" }),
  },
  manifestFile({ id: "charts", deps: [], capabilities: [], exports: [] }, ROOT),
  { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  { path: `${ROOT}/unsafe/detached.ts`, source: LIFTED },
  { path: "modules/shop/unsafe/detached.ts", source: LIFTED },
  { path: `${ROOT}/src/plain.ts`, source: TOP },
];
const e1207 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1207");

test("a detached `scope` inside the arrow function given to `unsafe(...)` is no E1207 in `node_modules/@acme/charts/unsafe/detached.ts`", () => {
  expect(e1207(project).filter((d) => d.path === `${ROOT}/unsafe/detached.ts`)).toEqual([]);
});

test("the same call inside `unsafe(...)` is one E1207 in `modules/shop/unsafe/detached.ts`", () => {
  const d = e1207(project).filter((x) => x.path === "modules/shop/unsafe/detached.ts");
  expect(d).toHaveLength(1);
  expect(d[0]?.line).toBe(2);
});

test("the same call at the top level of `node_modules/@acme/charts/src/plain.ts` is one E1207", () => {
  const d = e1207(project).filter((x) => x.path === `${ROOT}/src/plain.ts`);
  expect(d).toHaveLength(1);
  expect(d[0]?.line).toBe(2);
});
