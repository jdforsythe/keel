// Spec: k.reactive, clause "In `modules/m/a.ts`, `async function f() { await g(); return scope(() => undefined) }` is one E1208 at `scope` and `async function f() { await g(); return signal(0) }` one E1203 at `signal`; `async function f(c: Scope) { await g(); return c.run(() => scope(() => undefined)) }` and `function f() { return scope(() => undefined) }` are none."
// k.reactive, Static "In app code and a library's files `keel check` also reports, at the callee, E1208 for a call of `scope` (callee found as k.unsafe One path says) and E1203 for a call of `signal`, `computed`, `effect`, `resource` or `store` that follows an `await` in the same function body, not inside a nested function, unless it is inside a function given to a `run` call; message `<name> after await runs with no owner; use a captured scope's run`, no fix."
// Seed 1337. Fixtures are source text over in-memory file maps with the type pass on (the callee is found by its symbol).
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { manifestFile } from "./module-support.ts";
import { SEED } from "./support.ts";

const PATH = "modules/m/a.ts";
const MANIFEST = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD = `import { type Scope, scope, signal, computed, effect, resource } from '@keel/reactive'
import { s } from '@keel/schema'
import { store } from '@keel/store'
declare function g(): Promise<void>
const S = s.object({ n: s.number() })
`;

const run = (body: string) =>
  check([MANIFEST, { path: PATH, source: `${HEAD}${body}\n` }]).diagnostics.filter(
    (d) => d.code === "E1203" || d.code === "E1208",
  );
const at = (body: string, needle: string): { line: number; col: number } => {
  const source = `${HEAD}${body}\n`;
  const before = source.slice(0, source.indexOf(needle, HEAD.length)).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};

test("`async function f() { await g(); return scope(() => undefined) }` is one E1208 at `scope`", () => {
  const body = "export async function f() { await g(); return scope(() => undefined) }";
  const ds = run(body);
  expect(ds.map((d) => d.code)).toEqual(["E1208"]);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(body, "scope(() =>"));
  expect(ds[0]?.message).toBe("scope after await runs with no owner; use a captured scope's run");
  expect(ds[0]?.fix).toBeUndefined();
});

test("`async function f() { await g(); return signal(0) }` is one E1203 at `signal`", () => {
  const body = "export async function f() { await g(); return signal(0) }";
  const ds = run(body);
  expect(ds.map((d) => d.code)).toEqual(["E1203"]);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(body, "signal(0)"));
  expect(ds[0]?.message).toBe("signal after await runs with no owner; use a captured scope's run");
  expect(ds[0]?.fix).toBeUndefined();
});

test("`async function f(c: Scope) { await g(); return c.run(() => scope(() => undefined)) }` is none", () => {
  expect(run("export async function f(c: Scope) { await g(); return c.run(() => scope(() => undefined)) }")).toEqual(
    [],
  );
});

test("`function f() { return scope(() => undefined) }` is none", () => {
  expect(run("export function f() { return scope(() => undefined) }")).toEqual([]);
});

const MAKERS: readonly (readonly [string, string, string])[] = [
  ["signal", "signal(0)", "E1203"],
  ["computed", "computed(() => 1)", "E1203"],
  ["effect", "effect(() => undefined)", "E1203"],
  ["resource", "resource(() => Promise.resolve(1))", "E1203"],
  ["store", "store(S, { n: 0 })", "E1203"],
  ["scope", "scope(() => undefined)", "E1208"],
];

test("property: a call of `scope` is E1208 and of `signal`, `computed`, `effect`, `resource` or `store` is E1203, at the callee, message `<name> after await runs with no owner; use a captured scope's run`, when an `await` precedes it in the same function body", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...MAKERS),
      fc.constantFrom("async function", "async arrow", "async method"),
      fc.constantFrom("await g();", "const v = await g();", "if (await Promise.resolve(true)) { }"),
      ([name, call, code], shape, awaited) => {
        const inner = `${awaited} return ${call}`;
        const body =
          shape === "async function"
            ? `export async function f() { ${inner} }`
            : shape === "async arrow"
              ? `export const f = async () => { ${inner} }`
              : `export const o = { async f() { ${inner} } }`;
        const ds = run(body);
        expect(
          ds.map((d) => d.code),
          body,
        ).toEqual([code]);
        expect(ds[0]?.message).toBe(`${name} after await runs with no owner; use a captured scope's run`);
        expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(body, call));
      },
    ),
    { seed: SEED, numRuns: 80 },
  );
});

test("property: the same call before the `await`, in a nested function, or inside a function given to a `run` call is none", () => {
  fc.assert(
    fc.property(fc.constantFrom(...MAKERS), ([, call]) => {
      for (const body of [
        `export async function f() { const v = ${call}; await g(); return v }`,
        `export async function f() { await g(); const make = () => ${call}; return make }`,
        `export async function f(c: Scope) { await g(); return c.run(() => ${call}) }`,
        `export async function f(c: Scope) { await g(); return c.run(function () { return ${call} }) }`,
        `export async function f() { async function other() { await g() } void other; return ${call} }`,
        `export function f() { return ${call} }`,
      ]) {
        expect(run(body), body).toEqual([]);
      }
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("E1208 and E1203 after `await` are reported in a library's files as in app code", () => {
  const ROOT = "node_modules/@acme/charts";
  const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
  const ds = check([
    manifestFile({ id: "shop", deps: ["@acme/charts"] }),
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" }),
    },
    manifestFile({ id: "charts", deps: [], capabilities: [], exports: [] }, ROOT),
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    {
      path: `${ROOT}/src/late.ts`,
      source: `${HEAD}export async function f() { await g(); return [scope(() => undefined), signal(0)] }\n`,
    },
  ]).diagnostics.filter((d) => d.path === `${ROOT}/src/late.ts` && (d.code === "E1203" || d.code === "E1208"));
  expect(ds.map((d) => d.code).sort()).toEqual(["E1203", "E1208"]);
});
