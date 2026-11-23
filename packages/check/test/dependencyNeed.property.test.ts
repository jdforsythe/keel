// dependencyNeed (k.deploy E1572, k.shell Plugins): the diagnostic and its package.json fix for one needed package. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { dependencyNeed } from "../src/dependencyNeed.ts";

const run = { seed: 1337, numRuns: 200 };
const SOURCE =
  "import { topology } from '@keel/server'\nexport default topology({\n  api: { modules: [], adapter: 'node' },\n  web: { modules: ['c'], adapter: 'client' },\n})\n";
const lower = fc.stringMatching(/^[a-z]{2,8}$/);
const dep = fc.tuple(lower, lower).map(([a, b]) => `@${a}/${b}`);
const version = fc.tuple(fc.nat(30), fc.nat(30), fc.nat(30)).map((v) => v.join("."));
const others = fc.dictionary(
  lower.map((n) => `@other/${n}`),
  version,
  { maxKeys: 4 },
);
const pkgOf = (dependencies: Record<string, string>, indent = 2): string =>
  `${JSON.stringify({ name: "fx", dependencies }, null, indent)}\n`;
const at = (pkg: string, d: string, v?: string, need?: string) =>
  dependencyNeed({
    dir: "",
    source: SOURCE,
    pkg,
    deployable: "web",
    dep: d,
    message: `web: tauri needs ${d}`,
    version: v,
    need,
  });
/** The `package.json` a unified diff of `before` yields. */
function applied(before: string, fix: string): string {
  const out: string[] = [];
  const lines = before.split("\n");
  let i = 0;
  for (const hunk of fix.split(/^@@.*$/m).slice(1)) {
    for (const line of hunk.split("\n").slice(1)) {
      if (line.startsWith("+")) out.push(line.slice(1));
      else if (line.startsWith("-")) i++;
      else if (line.startsWith(" ")) {
        while (lines[i] !== line.slice(1) && i < lines.length) out.push(lines[i++] ?? "");
        out.push(lines[i++] ?? "");
      }
    }
  }
  return [...out, ...lines.slice(i)].join("\n");
}

describe("dependencyNeed", () => {
  test("an absent package is one E1572 at the deployable's key whose fix adds it at the version, keys sorted", () => {
    fc.assert(
      fc.property(dep, version, others, fc.constantFrom(2, 4), (d, v, rest, indent) => {
        fc.pre(!(d in rest));
        const pkg = pkgOf(rest, indent);
        const diag = at(pkg, d, v, "storage");
        expect(diag).toMatchObject({
          kind: "diag",
          code: "E1572",
          path: "topology.ts",
          line: 4,
          col: 3,
          see: "k.deploy",
        });
        expect(diag?.message).toBe(`web: tauri needs ${d} ${v} in package.json dependencies (storage)`);
        const next: unknown = JSON.parse(applied(pkg, diag?.fix ?? ""));
        const deps: unknown = Reflect.get(Object(next), "dependencies");
        expect(deps).toEqual({ ...rest, [d]: v });
        expect(Object.keys(Object(deps))).toEqual(Object.keys({ ...rest, [d]: v }).sort());
      }),
      run,
    );
  });

  test("another version text is one E1572 whose fix sets the version; the exact text is none", () => {
    fc.assert(
      fc.property(dep, version, fc.constantFrom("^", "~", ">=", "workspace:"), (d, v, range) => {
        const diag = at(pkgOf({ [d]: `${range}${v}` }), d, v);
        expect(diag?.message).toBe(`web: tauri needs ${d} ${v} in package.json dependencies`);
        expect(diag?.fix).toContain(`-    "${d}": "${range}${v}"`);
        expect(diag?.fix).toContain(`+    "${d}": "${v}"`);
        expect(at(pkgOf({ [d]: v }), d, v)).toBeUndefined();
      }),
      run,
    );
  });

  test("with no version any listed spec passes, and the fix adds the spec of the first @keel/ dependency, else *", () => {
    fc.assert(
      fc.property(dep, version, (d, v) => {
        expect(at(pkgOf({ [d]: `^${v}` }), d)).toBeUndefined();
        expect(at(pkgOf({ "@keel/cli": "workspace:*" }), d)?.fix).toContain(`+    "${d}": "workspace:*"`);
        expect(at(pkgOf({}), d)?.fix).toContain(`"${d}": "*"`);
        expect(at(pkgOf({}), d)?.message).toBe(`web: tauri needs ${d} in package.json dependencies`);
      }),
      run,
    );
  });

  test("a package.json that is not a JSON object reports nothing; one with no dependencies gains them", () => {
    for (const bad of ["", "nope", "[]", "null", "3", '"x"']) expect(at(bad, "@x/p", "1.2.3")).toBeUndefined();
    const diag = at('{\n  "name": "fx"\n}\n', "@x/p", "1.2.3");
    expect(JSON.parse(applied('{\n  "name": "fx"\n}\n', diag?.fix ?? ""))).toEqual({
      name: "fx",
      dependencies: { "@x/p": "1.2.3" },
    });
  });

  test("a deployable the source does not name is reported at the file's start, under dir", () => {
    const diag = dependencyNeed({
      dir: "apps/a/",
      source: SOURCE,
      pkg: "{}",
      deployable: "gone",
      dep: "@x/p",
      message: "m",
    });
    expect(diag).toMatchObject({ path: "apps/a/topology.ts", line: 1, col: 1 });
    expect(diag?.fix).toContain("apps/a/package.json");
  });
});
