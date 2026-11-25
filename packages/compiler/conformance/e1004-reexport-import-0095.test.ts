// Spec: k.compiler, clause "`export * from './a.server'` and `import('./a.server')` in client-reachable code are each E1004; `export type` from it is not."
// Seed: 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, codes } from "./support.ts";

const server = { path: "a.server.ts", source: "export const secret = 1\nexport type T = number\n" };
const e1004 = (source: string, path = "C.tsx") => codes(source, path, [server]).filter((d) => d.code === "E1004");

describe("k.compiler: E1004 re-exports and dynamic imports", () => {
  test("`export * from './a.server'` in client-reachable code is E1004", () => {
    const hit = e1004("export * from './a.server'\n", "re.ts");
    expect(hit).toHaveLength(1);
    expect(hit[0]?.path).toBe("re.ts");
  });

  test("`import('./a.server')` in client-reachable code is E1004", () => {
    const hit = e1004("export const load = () => import('./a.server')\n", "lazy.ts");
    expect(hit).toHaveLength(1);
    expect(hit[0]?.path).toBe("lazy.ts");
  });

  test("`export type` from it is not E1004", () => {
    expect(e1004("export type { T } from './a.server'\n", "ty.ts")).toEqual([]);
  });

  test("`export { secret } from './a.server'` in client-reachable code is E1004", () => {
    expect(e1004("export { secret } from './a.server'\n", "named.ts")).toHaveLength(1);
  });

  test("a re-export or literal `import()` of it from another server module is not E1004", () => {
    expect(e1004("export * from './a.server'\n", "b.server.ts")).toEqual([]);
    expect(e1004("export const load = () => import('./a.server')\n", "c.server.ts")).toEqual([]);
  });

  test("property: any re-export form or literal `import()` of the server module is one E1004 in a client file, none for `export type`", () => {
    const forms = fc.constantFrom(
      "export * from './a.server'\n",
      "export * as ns from './a.server'\n",
      "export { secret } from './a.server'\n",
      "export { secret as other } from './a.server'\n",
      "export const l = () => import('./a.server')\n",
      "export const l = async () => (await import('./a.server')).secret\n",
    );
    const typeForms = fc.constantFrom("export type { T } from './a.server'\n", "export type * from './a.server'\n");
    const name = fc.stringMatching(/^[a-z]{3,8}$/);
    fc.assert(
      fc.property(forms, typeForms, name, (form, typeForm, n) => {
        expect(e1004(form, `${n}.ts`)).toHaveLength(1);
        expect(e1004(typeForm, `${n}.ts`)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
