// Seed 1337. Properties of the k.module pass helpers and fixes.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type SourceFile, check } from "../src/index.ts";
import { joinPath } from "../src/internal/modules/joinPath.ts";
import { applyPatch } from "./support/applyPatch.ts";

const SEED = 1337;
const id = fc.stringMatching(/^[a-z]{3,8}$/);
const pascal = fc.stringMatching(/^[A-Z][a-z]{2,7}$/);
const f = (path: string, source: string): SourceFile => ({ path, source });
const list = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
const man = (m: string, exports: string[]) =>
  f(
    `modules/${m}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${m}', deps: [], capabilities: [], public: { exports: ${list(exports)}, routes: [] } })\n`,
  );
const codes = (files: SourceFile[], code: string) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === code);

describe("module pass properties", () => {
  it("joinPath: resolving a child segment then '..' returns the directory", () => {
    fc.assert(
      fc.property(fc.array(id, { maxLength: 4 }), id, (dirs, seg) => {
        const dir = dirs.join("/");
        expect(joinPath(dir, `./${seg}/..`)).toBe(dir);
        expect(joinPath(dir, `../${seg}`)).toBe([...dirs.slice(0, -1), seg].join("/"));
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("E1154: one diagnostic per missing export, and applying each fix in turn clears them all", () => {
    fc.assert(
      fc.property(
        id,
        fc.uniqueArray(pascal, { minLength: 1, maxLength: 5 }),
        fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
        (m, names, present) => {
          const exists = names.filter((_, i) => present[i] === true);
          let files = [man(m, names), ...exists.map((n) => f(`modules/${m}/${n}.ts`, `export const ${n} = 1\n`))];
          expect(codes(files, "E1154")).toHaveLength(names.length - exists.length);
          for (let d = codes(files, "E1154")[0]; d !== undefined; d = codes(files, "E1154")[0]) {
            const fix = d.fix ?? "";
            files = files.map((x) => (x.path === d?.path ? f(x.path, applyPatch(x.path, x.source, fix)) : x));
          }
          expect(files[0]?.source).toContain(`exports: ${list(names.filter((n) => exists.includes(n)))}`);
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("module diagnostics do not depend on unrelated files outside every module", () => {
    fc.assert(
      fc.property(id, pascal, fc.array(pascal, { maxLength: 4 }), (m, ghost, extra) => {
        const base = [man(m, [ghost])];
        const noise = extra.map((n) => f(`src/${n}.ts`, `export const ${n} = 1\n`));
        const only = (files: SourceFile[]) =>
          check(files, { types: false }).diagnostics.filter((d) => /^E115/.test(d.code));
        expect(only([...noise, ...base])).toEqual(only(base));
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
