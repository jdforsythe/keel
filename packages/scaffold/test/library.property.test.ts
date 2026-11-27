// Seed 1337 (`SEED`). `scaffold library <name>` (k.library-pack Scaffold): a name `@<scope>/<base>` of lowercase letters,
// digits and `-` writes the twelve files under `<base>/`, `module.ts` holding the base in lowerCamel; any other name is
// E1352 and an existing `<base>/` E1351, each writing nothing; equal input gives byte-equal output.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { scaffold } from "../src/index.ts";
import { RUNS, SEED } from "./helpers.ts";

const FILES = [
  ".gitignore",
  "README.md",
  "module.ts",
  "package.json",
  "src/Example.tsx",
  "src/index.ts",
  "test/Example.e2e.ts",
  "test/Example.test.ts",
  "tokens.ts",
  "tsconfig.build.json",
  "tsconfig.json",
  "vitest.config.ts",
];
const seg = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
const scope = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,5}$/);
const camel = (segs: readonly string[]): string =>
  segs.map((s, i) => (i === 0 ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`)).join("");
const codeOf = (r: ReturnType<typeof scaffold>): string | undefined => (r.ok ? undefined : r.error.data.code);

describe("scaffold library", () => {
  it("writes the twelve files under <base>/, the id the base in lowerCamel, the kernel peers at the given version", () => {
    fc.assert(
      fc.property(scope, fc.array(seg, { minLength: 1, maxLength: 3 }), (sc, segs) => {
        const base = segs.join("-");
        const r = scaffold("library", { name: `@${sc}/${base}`, version: "1.2.3" }, new Map());
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.created).toEqual(FILES.map((f) => `${base}/${f}`));
        expect(r.value.files.get(`${base}/module.ts`)).toContain(`id: '${camel(segs)}'`);
        const pkg: unknown = JSON.parse(r.value.files.get(`${base}/package.json`) ?? "");
        const peers = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "peerDependencies") : undefined;
        expect(peers).toEqual({
          "@keel/compiler": "^1.2.3",
          "@keel/reactive": "^1.2.3",
          "@keel/runtime-dom": "^1.2.3",
          "@keel/schema": "^1.2.3",
          "@keel/ui": "^1.2.3",
        });
        const dev = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "devDependencies") : undefined;
        expect(dev).toMatchObject({
          "@keel/compiler": "^1.2.3",
          "@keel/router": "^1.2.3",
          "@keel/server": "^1.2.3",
          "@keel/testing": "^1.2.3",
          "playwright-core": "1.65.0",
        });
        const e2e = r.value.files.get(`${base}/test/Example.e2e.ts`) ?? "";
        expect(e2e).toContain(`serve({ page: "src/Example.tsx", props: { id: "lib" } })`);
        expect(e2e).toContain("a11y()");
        expect(r.value.files.get(`${base}/.gitignore`)).toContain(".keel/e2e-host-*/");
        const again = scaffold("library", { name: `@${sc}/${base}`, version: "1.2.3" }, new Map());
        expect(again.ok && [...again.value.files]).toEqual([...r.value.files]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("refuses a name of another form with E1352 and an existing <base>/ with E1351", () => {
    const bad = fc.oneof(
      seg,
      seg.map((s) => `@${s}`),
      seg.map((s) => `@${s}/`),
      fc.tuple(seg, seg).map(([a, b]) => `@${a}/${b.toUpperCase()}x`),
      fc.tuple(seg, seg).map(([a, b]) => `@${a}/${b}_${b}`),
      fc.tuple(seg, seg).map(([a, b]) => `@${a}/${b}/${a}`),
      fc.tuple(seg, seg).map(([a, b]) => `@${a}/-${b}`),
      fc.tuple(seg, fc.integer({ min: 0, max: 9 })).map(([a, d]) => `@${a}/${d}x`),
    );
    fc.assert(
      fc.property(bad, (name) => {
        expect(codeOf(scaffold("library", { name }, new Map()))).toBe("E1352");
      }),
      { seed: SEED, numRuns: RUNS },
    );
    const taken = new Map([["charts/keep.txt", "mine\n"]]);
    expect(codeOf(scaffold("library", { name: "@acme/charts" }, taken))).toBe("E1351");
    expect(codeOf(scaffold("library", { name: "@acme/charts", exists: true }, new Map()))).toBe("E1351");
    expect(codeOf(scaffold("library", {}, new Map()))).toBe("E1052");
  });
});
