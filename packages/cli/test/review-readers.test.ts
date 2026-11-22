// keel review's readers (k.escapes): each code on a small source and on its near miss, the folded strings, the
// manifest, workspace and lockfile entries, and the id recipe recomputed from k.review Findings. Seed 1337.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { codeEscapes } from "../src/review/codeEscapes.ts";
import { escapeId } from "../src/review/escapeId.ts";
import { fileEscapes } from "../src/review/fileEscapes.ts";
import { kindOf } from "../src/review/kindOf.ts";
import { lockEscapes } from "../src/review/lockEscapes.ts";
import { manifestEscapes } from "../src/review/manifestEscapes.ts";
import { workspaceEscapes } from "../src/review/workspaceEscapes.ts";

const SEED = 1337;
const fixture = (name: string): string =>
  readFileSync(new URL(`../conformance/unsafe/review-fixtures/${name}`, import.meta.url), "utf8");
const codes = (path: string, src: string, dir: string | null = ""): string[] =>
  fileEscapes(path, src, dir).map((r) => r.code);

describe("code readers", () => {
  test("R1001 and R1012 read a call by its callee, with the reason folded", () => {
    const [u] = codeEscapes(
      "modules/m/u.ts",
      'unsafe("a reason " + "long enough", () => 1);\n',
      kindOf("modules/m/u.ts", ""),
    );
    expect(u?.code).toBe("R1001");
    expect(u?.reason).toBe("a reason long enough");
    expect(codes("modules/m/a.server.ts", "export const t = reveal(token);\n")).toEqual(["R1012"]);
    expect(codes("modules/m/a.ts", "export const t = x.reveal(token);\n")).toEqual([]);
  });

  test("R1010 reads each origin of topology.ts with its directive's danger and its reason", () => {
    const src =
      "export default { web: { origins: { img: { 'https://i.example': 'photos' }, connect: { 'https://c.example': 'api' } } } };\n";
    const found = codeEscapes("topology.ts", src, kindOf("topology.ts", ""));
    expect(found.map((r) => [r.code, r.danger, r.reason])).toEqual([
      ["R1010", "low", "photos"],
      ["R1010", "high", "api"],
    ]);
    expect(codeEscapes("modules/m/a.ts", src, kindOf("modules/m/a.ts", ""))).toEqual([]);
  });

  test("R1011 and R1014: createApp's allow and an identity handle", () => {
    expect(codes("app.server.ts", "createApp({ allow: ['https://a.example'] });\n")).toEqual(["R1011"]);
    expect(
      codes("identity.server.ts", "export default identity({ identify, handle: { path: '/auth', fn } });\n"),
    ).toEqual(["R1014"]);
    expect(codes("app.server.ts", "createApp({ identity: { handle: { path: '/auth', fn } } });\n")).toEqual(["R1014"]);
    expect(codes("deploy/web/.env", "KEEL_ALLOW_ORIGINS=https://a.example\n")).toEqual(["R1011"]);
    expect(codes("README.md", "Set KEEL_ALLOW_ORIGINS.\n")).toEqual([]);
  });

  test("R1050 reads outside app code only, and never as const", () => {
    const cast = fixture("cast.ts");
    for (const p of [
      "modules/m/c.test.ts",
      "modules/m/t.d.ts",
      "vite.config.ts",
      "modules/m/unsafe/a.ts",
      ".keel/x.ts",
    ])
      expect(codes(p, cast), p).toContain("R1050");
    expect(codes("modules/m/a.ts", cast)).toEqual([]);
    expect(codes("modules/m/c.test.ts", "export const a = [1] as const;\n")).toEqual([]);
    expect(codes("modules/m/c.test.ts", fixture("ts-suppress.ts"))).toEqual(["R1050"]);
    expect(codes("modules/m/c.test.ts", fixture("bang.ts"))).toEqual(["R1050"]);
    expect(codes("modules/m/c.test.ts", fixture("any.ts"))).toEqual(["R1050"]);
  });

  test("R1051 reads a comment that starts a lint suppression, not prose", () => {
    expect(codes("modules/m/d.ts", fixture("disable-comments.ts"))).toEqual(["R1051", "R1051", "R1051"]);
    expect(codes("modules/m/d.ts", "// see the lint docs on eslint-disable\nexport const a = 1;\n")).toEqual([]);
  });

  test("R1052 folds each form once and reads past a comment opener", () => {
    expect(codes("modules/m/f.ts", fixture("folded-directives.ts"))).toEqual(["R1052", "R1052", "R1052", "R1052"]);
    expect(codes("modules/m/p.ts", fixture("prose-directives.ts"))).toEqual([]);
    const opener = 'export const a = "// " + ["eslint", "-disable"].join("");\n';
    expect(codes("modules/m/o.ts", opener)).toEqual(["R1052"]);
  });

  test("R1053: computed specifiers; a bundler glob beside the file and a worker URL are none", () => {
    expect(codes("modules/m/i.ts", fixture("computed-specifiers.ts"))).toEqual(["R1053", "R1053", "R1053"]);
    const sanctioned = [
      "export const load = (l: string) => import(`./Text/${l}.ts`);\n",
      'export const w = new Worker(new URL("./w.ts", import.meta.url));\n',
      'export const a = import("./a.ts");\n',
    ];
    for (const s of sanctioned) expect(codes("modules/m/a.ts", s), s).toEqual([]);
    expect(codes("modules/m/a.ts", "export const w = (u: string) => new Worker(u);\n")).toEqual(["R1053"]);
    expect(codes("modules/m/a.ts", "export const r = (u: string) => import.meta.resolve(u);\n")).toEqual(["R1053"]);
    expect(codes("modules/m/a.ts", "export const load = (l: string) => import(`${l}/x.ts`);\n")).toEqual(["R1053"]);
  });

  test("R1055: a Keel package's private files, not its public or internal entries", () => {
    expect(codes("modules/m/k.ts", 'import { x } from "@keel/compiler/src/a.ts";\n')).toEqual(["R1055"]);
    expect(codes("modules/m/k.ts", 'import { x } from "../../node_modules/@keel/ui/dist/a.js";\n')).toEqual(["R1055"]);
    expect(
      codes("modules/m/k.ts", 'import { x } from "@keel/ui";\nimport { y } from "@keel/compiler/internal";\n'),
    ).toEqual([]);
  });

  test("R1056: a computed global key and an indirect eval", () => {
    expect(codes("modules/m/g.ts", fixture("computed-global.ts"))).toEqual(["R1056", "R1056"]);
    expect(codes("modules/m/g.ts", 'export const f = globalThis["fetch"];\n')).toEqual([]);
  });

  test("R1057 reads server and test files; child_process is critical; one finding per env read", () => {
    expect(codes("modules/m/s.server.ts", fixture("env.ts"))).toEqual(["R1057"]);
    expect(codes("modules/m/s.ts", fixture("env.ts"))).toEqual([]);
    const [cp] = codeEscapes("modules/m/x.test.ts", fixture("child-process.ts"), kindOf("modules/m/x.test.ts", ""));
    expect(cp?.danger).toBe("critical");
    const reads =
      'export const a = process.env.A;\nexport const b = process.env["B"];\nexport const c = process.env;\n';
    expect(codes("modules/m/s.guard.ts", reads)).toEqual(["R1057", "R1057", "R1057"]);
    expect(codes("modules/m/unsafe/s.server.ts", 'unsafe("r", () => fetch("/x"));\n')).toEqual(["R1001", "R1057"]);
  });

  test("R1058 and R1059", () => {
    expect(codes("modules/m/unsafe/n.ts", "export const n = 1;\n")).toEqual(["R1058"]);
    expect(codes("modules/m/unsafe/n.ts", 'export const n = unsafe("why", () => 1);\n')).toEqual(["R1001"]);
    expect(codes("modules/m/t.test.ts", fixture("test-only.ts"))).toEqual(["R1059"]);
    expect(codes("modules/m/t.test.ts", fixture("test-skip.ts"))).toEqual(["R1059"]);
    expect(codes("modules/m/t.ts", fixture("test-skip.ts"))).toEqual([]);
    expect(codes("modules/m/t.test.ts", 'describe.concurrent.only("s", () => {});\ntest.skipIf(c)("t", f);\n')).toEqual(
      ["R1059", "R1059"],
    );
  });

  test("R1150 is the one finding of a file that does not parse", () => {
    expect(codes("modules/m/bad.ts", "export const = ;\nunsafe();\n")).toEqual(["R1150"]);
  });
});

describe("manifests, workspace files and lockfiles", () => {
  test("package.json: overrides, patches and install scripts", () => {
    const pkg = JSON.stringify(
      {
        name: "p",
        scripts: { build: "tsc", postinstall: "node x.js" },
        overrides: { a: "1" },
        pnpm: {
          patchedDependencies: { b: "patches/b.patch" },
          onlyBuiltDependencies: ["esbuild"],
          allowBuilds: { c: true, d: false },
        },
      },
      null,
      2,
    );
    expect(manifestEscapes(pkg).map((r) => [r.code, r.text])).toEqual([
      ["R1101", '"a": "1"'],
      ["R1101", '"b": "patches/b.patch"'],
      ["R1102", '"postinstall": "node x.js"'],
      ["R1102", '"esbuild": true'],
      ["R1102", '"c": true'],
    ]);
    expect(manifestEscapes("{ not json")).toEqual([]);
  });

  test("pnpm-workspace.yaml: overrides, patched dependencies and builds", () => {
    const yaml = [
      "packages:",
      "  - 'apps/*'",
      "allowBuilds:",
      "  esbuild: false",
      "  sharp: true",
      "overrides:",
      "  'a>b': ^1.0.0",
      "onlyBuiltDependencies: [x, 'y']",
      "",
    ].join("\n");
    expect(workspaceEscapes(yaml).map((r) => [r.code, r.line])).toEqual([
      ["R1102", 5],
      ["R1101", 7],
      ["R1102", 8],
      ["R1102", 8],
    ]);
  });

  test("lockfiles: a resolution outside the registry", () => {
    const pnpm = (r: string): string => `lockfileVersion: '9.0'\npackages:\n  left-pad@1.0.0:\n    resolution: ${r}\n`;
    expect(lockEscapes("pnpm-lock.yaml", pnpm("{integrity: sha512-AA==}"))).toEqual([]);
    const [git] = lockEscapes("pnpm-lock.yaml", pnpm("{tarball: git+https://example.invalid/a.git}"));
    expect(git?.text).toBe("left-pad@1.0.0: resolution: {tarball: git+https://example.invalid/a.git}");
    expect(lockEscapes("pnpm-lock.yaml", pnpm("{directory: ../a, type: directory}"))).toHaveLength(1);
    const npm = JSON.stringify({
      packages: {
        "node_modules/a": { resolved: "git+ssh://x/a.git" },
        "node_modules/b": { resolved: "https://registry.npmjs.org/b.tgz" },
      },
    });
    expect(lockEscapes("package-lock.json", npm).map((r) => r.code)).toEqual(["R1101"]);
    expect(
      lockEscapes("yarn.lock", 'a@1:\n  resolved "file:../a.tgz"\nb@1:\n  resolved "https://r/b.tgz"\n'),
    ).toHaveLength(1);
  });

  test("a tracked node_modules file and a patch are each one R1101", () => {
    expect(codes("node_modules/a/index.js", "x")).toEqual(["R1101"]);
    expect(codes("patches/a.patch", "x")).toEqual(["R1101"]);
    expect(codes("apps/x/patches/a.patch", "x", "apps/x/")).toEqual(["R1101"]);
    expect(codes("apps/x/modules/patches/a.ts", "export const a = 1;\n", "apps/x/")).toEqual([]);
  });
});

describe("id", () => {
  test("the recipe of k.review Findings recomputes it", () => {
    const want = createHash("sha256").update("R1050\nmodules/m/c.test.ts\n1 as number#2").digest("hex").slice(0, 12);
    expect(escapeId("R1050", "modules/m/c.test.ts", "  1\n  as\tnumber ", 2)).toBe(want);
    expect(escapeId("R1050", "a.ts", "x", 0)).toBe(
      createHash("sha256").update("R1050\na.ts\nx").digest("hex").slice(0, 12),
    );
  });

  test("whitespace runs do not change an id; any other text does", () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { minLength: 1, maxLength: 5 }),
        fc.constantFrom(" ", "  ", "\t", "\n "),
        (words, gap) => {
          expect(escapeId("R1001", "a.ts", words.join(gap), 0)).toBe(escapeId("R1001", "a.ts", words.join(" "), 0));
          expect(escapeId("R1001", "a.ts", `${words.join(" ")}x`, 0)).not.toBe(
            escapeId("R1001", "a.ts", words.join(" "), 0),
          );
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});
