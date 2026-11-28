// Seed 1337. The parts of `keel pack` that read a library's folder without running it (k.library-pack Pack): the
// `package` step (`packageShape`) refuses, with one E1164 at the `package.json` field, what an app could not read the
// same way; `jsonFieldAt` finds a top-level key and never a nested one; `filesSelect` and `packFiles` select as `files` does.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { filesSelect } from "../src/internal/filesSelect.ts";
import { jsonFieldAt } from "../src/internal/jsonFieldAt.ts";
import { packFiles } from "../src/internal/packFiles.ts";
import { packageShape } from "../src/internal/packageShape.ts";

const SEED = 1337;
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const PKG = {
  name: "@acme/charts",
  version: "1.0.0",
  type: "module",
  keel: "library",
  exports: { ".": { keel: "./src/index.ts", types: "./dist/src/index.d.ts", default: "./dist/src/index.js" } },
  files: ["module.ts", "src", "dist", ".keel/ledger.json", "README.md"],
  peerDependencies: {
    "@keel/compiler": "^1.0.0",
    "@keel/reactive": "^1.0.0",
    "@keel/runtime-dom": "^1.0.0",
    "@keel/ui": "^1.0.0",
  },
};
const FILES: Record<string, string> = {
  "module.ts":
    "import { module } from '@keel/compiler'\nexport default module({ id: 'charts', deps: [], capabilities: [], public: { exports: [] } })\n",
  "src/index.ts": "export { default as Badge } from './Badge.tsx'\n",
  "src/Badge.tsx":
    "import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return <Box id={`${props.id}.box`} />\n}\n",
};

/** A library folder: `pkg` as its `package.json` (two-space JSON), `files` beside it. */
function folder(pkg: Record<string, unknown>, files: Record<string, string> = FILES): { dir: string; text: string } {
  const dir = tempDir("keel-pack-");
  made.push(dir);
  const text = `${JSON.stringify(pkg, null, 2)}\n`;
  for (const [rel, src] of Object.entries({ ...files, "package.json": text })) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), src);
  }
  return { dir, text };
}
const shape = (pkg: Record<string, unknown>, files?: Record<string, string>) => {
  const { dir, text } = folder(pkg, files);
  return packageShape(dir, pkg, text);
};

describe("the package step", () => {
  it("passes the scaffold's shape", () => {
    expect(shape(PKG)).toBeUndefined();
  });

  const refused: [string, Record<string, unknown>, Record<string, string> | undefined, string, string][] = [
    ["no root module.ts", PKG, { "src/index.ts": FILES["src/index.ts"] ?? "" }, "keel", "has no root module.ts"],
    [
      "no keel condition",
      { ...PKG, exports: { ".": { default: "./dist/src/index.js" } } },
      undefined,
      "exports",
      "lists no keel condition first",
    ],
    [
      "keel after another condition",
      { ...PKG, exports: { ".": { default: "./dist/src/index.js", keel: "./src/index.ts" } } },
      undefined,
      "exports",
      "lists no keel condition first",
    ],
    [
      "keel after another condition in a subpath entry",
      {
        ...PKG,
        exports: { ...PKG.exports, "./x": { default: "./dist/src/index.js", keel: "./src/index.ts" } },
      },
      undefined,
      "exports",
      'exports "./x" lists keel after another',
    ],
    [
      "keel nested under another condition",
      {
        ...PKG,
        exports: {
          ".": { ...PKG.exports["."] },
          "./x": { import: { default: "./dist/src/index.js", keel: "./src/index.ts" } },
        },
      },
      undefined,
      "exports",
      'exports "./x" nests keel under another condition',
    ],
    [
      "a keel target outside src/",
      { ...PKG, exports: { ".": { keel: "./index.ts" } } },
      undefined,
      "exports",
      "keel is no file under src/ or unsafe/",
    ],
    [
      "a keel target missing",
      { ...PKG, exports: { ".": { keel: "./src/none.ts" } } },
      undefined,
      "exports",
      "keel is no file under src/ or unsafe/",
    ],
    ["no files", { ...PKG, files: undefined }, undefined, "keel", "lists no files"],
    [
      "files without the ledger",
      { ...PKG, files: ["module.ts", "src", "dist"] },
      undefined,
      "files",
      "files omits .keel/ledger.json",
    ],
    [
      "files without src",
      { ...PKG, files: ["module.ts", "dist", ".keel/ledger.json"] },
      undefined,
      "files",
      "files omits src/Badge.tsx",
    ],
    [
      "files without module.ts",
      { ...PKG, files: ["src", "dist", ".keel/ledger.json"] },
      undefined,
      "files",
      "files omits module.ts",
    ],
    [
      "unsafe/ not shipped",
      PKG,
      { ...FILES, "unsafe/u.ts": "export const u = 1\n" },
      "files",
      "files omits unsafe/u.ts",
    ],
    [
      "the built entry not shipped",
      { ...PKG, files: ["module.ts", "src", ".keel/ledger.json"] },
      undefined,
      "files",
      "files omits dist/src/index.d.ts",
    ],
    [
      "a peer missing",
      { ...PKG, peerDependencies: { "@keel/compiler": "^1.0.0" } },
      undefined,
      "peerDependencies",
      "peerDependencies omits @keel/reactive",
    ],
    [
      "a kernel dependency",
      { ...PKG, dependencies: { "@keel/ui": "^1.0.0" } },
      undefined,
      "dependencies",
      "dependencies lists @keel/ui; a peer resolves to the app's",
    ],
    [
      "a .env shipped",
      { ...PKG, files: [...PKG.files, ".env"] },
      { ...FILES, ".env": "SECRET=1\n" },
      "files",
      "files ships .env",
    ],
    [
      "tokens.ts shipped",
      { ...PKG, files: [...PKG.files, "tokens.ts"] },
      { ...FILES, "tokens.ts": "export const tokens = {}\n" },
      "files",
      "files ships tokens.ts",
    ],
    [
      "a code file outside the read places shipped",
      { ...PKG, files: [...PKG.files, "lib"] },
      { ...FILES, "lib/x.ts": "export const x = 1\n" },
      "files",
      "files ships lib/x.ts, code outside module.ts, src/ and unsafe/",
    ],
  ];
  for (const [what, pkg, files, field, message] of refused)
    it(`refuses ${what}: one E1164 at the ${field} field, its message beginning with package`, () => {
      const { dir, text } = folder(pkg, files);
      const d = packageShape(dir, pkg, text);
      expect(d?.code).toBe("E1164");
      expect(String(d?.message)).toMatch(/^package /);
      expect(String(d?.message)).toContain(message);
      expect(String(d?.message).length).toBeLessThanOrEqual(89);
      expect(d?.path).toBe("package.json");
      const at = jsonFieldAt(text, field);
      if (field !== "keel" || at !== undefined) expect({ line: d?.line, col: d?.col }).toEqual(at);
    });

  it("a .env not selected by files is not refused: the tarball never holds it", () => {
    expect(shape(PKG, { ...FILES, ".env": "SECRET=1\n", "tokens.ts": "export const tokens = {}\n" })).toBeUndefined();
  });
});

describe("the package step, code outside the read places", () => {
  it("passes a library shipping only module.ts, src/, unsafe/ and dist/ code", () => {
    const pkg = { ...PKG, files: [...PKG.files, "unsafe"] };
    const files = { ...FILES, "unsafe/raw.ts": "export const raw = 1\n", "dist/src/index.js": "export {}\n" };
    expect(shape(pkg, files)).toBeUndefined();
  });
  it("does not refuse a code file that files leaves out of the tarball", () => {
    expect(shape(PKG, { ...FILES, "lib/x.ts": "export const x = 1\n" })).toBeUndefined();
  });
});

describe("jsonFieldAt", () => {
  const key = fc.stringMatching(/^[a-z][a-zA-Z]{0,8}$/);
  it("gives where a top-level key's value begins, never a nested key of the same name", () => {
    fc.assert(
      fc.property(key, key, fc.integer({ min: 0, max: 3 }), (k, other, nest) => {
        fc.pre(k !== other);
        let inner: unknown = { [k]: 1 };
        for (let i = 0; i < nest; i++) inner = { [other]: inner };
        const text = `${JSON.stringify({ [other]: inner, [k]: "v" }, null, 2)}\n`;
        const at = jsonFieldAt(text, k);
        const lines = text.split("\n");
        expect(at).toBeDefined();
        expect(lines[(at?.line ?? 1) - 1]?.slice((at?.col ?? 1) - 1)).toBe('"v"');
      }),
      { seed: SEED, numRuns: 100 },
    );
    expect(jsonFieldAt('{"a":{"b":1}}', "b")).toBeUndefined();
    expect(jsonFieldAt('{"a":"\\"b\\":2","b":3}', "b")).toEqual({ line: 1, col: 20 });
  });
});

describe("files", () => {
  it("selects an entry, what lies under it and its glob; a `!` entry excludes", () => {
    expect(filesSelect(["src"], "src/a.ts")).toBe(true);
    expect(filesSelect(["./src/"], "src/a/b.ts")).toBe(true);
    expect(filesSelect(["src"], "srcx/a.ts")).toBe(false);
    expect(filesSelect(["src/*.ts"], "src/a.ts")).toBe(true);
    expect(filesSelect(["src/*.ts"], "src/a/b.ts")).toBe(false);
    expect(filesSelect(["src/**/*.ts"], "src/a/b.ts")).toBe(true);
    expect(filesSelect(["src", "!src/x.ts"], "src/x.ts")).toBe(false);
  });
  it("packs the manifest, README and LICENSE always, and nothing under node_modules", () => {
    const { dir } = folder(PKG, {
      ...FILES,
      "README.md": "#\n",
      LICENSE: "x\n",
      "src/node_modules/a.js": "x\n",
      "other.ts": "x\n",
    });
    expect(packFiles(dir, ["src"])).toEqual(["LICENSE", "README.md", "package.json", "src/Badge.tsx", "src/index.ts"]);
  });
});
