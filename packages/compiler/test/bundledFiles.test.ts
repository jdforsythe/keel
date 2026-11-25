// k.server-deps Files a bundled package reads: what a server build copies beside `server.mjs`, and what fails it (E1014).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { afterAll, expect, it } from "vitest";
import { bundledFiles } from "../src/internal/bundledFiles.ts";

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-bundled-")));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

/** A package `node_modules/p` under a fresh folder: `files` relative to it; returns the absolute path of `index.js`. */
function pkg(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(root, "app-"));
  for (const [rel, text] of Object.entries(files)) {
    const at = path.join(dir, "node_modules", "p", rel);
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, text);
  }
  return path.join(dir, "node_modules", "p", "index.js");
}
const url = (first: string): string => `export const u = new URL(${first}, import.meta.url)\n`;

it("a literal naming a file or folder inside the file's folder is copied to the same path; `./` and none differ", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("a.bin", "./a.bin", "sub/b.bin", "./sub/b.bin", "sub/../a.bin", "sub", "`a.bin`"),
      (f) => {
        const index = pkg({ "index.js": url(f.startsWith("`") ? f : `'${f}'`), "a.bin": "A", "sub/b.bin": "B" });
        const r = bundledFiles([index]);
        expect(r.problems).toEqual([]);
        const want = f.includes("b.bin") ? "sub/b.bin" : f === "sub" ? "sub" : "a.bin";
        expect(r.copies.map((c) => c.rel.split(path.sep).join("/"))).toEqual([want]);
        expect(r.copies[0]?.from).toBe(path.join(path.dirname(index), want));
      },
    ),
    { seed: 1337, numRuns: 14 },
  );
});

it("an absolute URL, the folder itself, another base and a file outside node_modules are left alone", () => {
  for (const first of ["'https://example.com/x'", "'data:text/plain,x'", "'.'", "'./'"]) {
    expect(bundledFiles([pkg({ "index.js": url(first) })])).toEqual({ copies: [], problems: [] });
  }
  const other = pkg({ "index.js": "const base = 'file:///x/'\nexport const u = new URL('./a.bin', base)\n" });
  expect(bundledFiles([other])).toEqual({ copies: [], problems: [] });
  const app = path.join(root, "app.js");
  fs.writeFileSync(app, url("'./missing.bin'"));
  expect(bundledFiles([app])).toEqual({ copies: [], problems: [] });
});

it("a missing file, a path leaving the folder and a first argument of any other form are each one E1014 at the package file", () => {
  const cases: [string, string][] = [
    ["'./gone.bin'", "reads ./gone.bin, which is missing"],
    ["'../up.bin'", "reads ../up.bin, outside its own folder"],
    ["'/abs.bin'", "reads /abs.bin, outside its own folder"],
    ["name", "reads new URL(x, import.meta.url) with x no string literal"],
    ["`./${name}.bin`", "reads new URL(x, import.meta.url) with x no string literal"],
    ["'a' + '.bin'", "reads new URL(x, import.meta.url) with x no string literal"],
  ];
  for (const [first, message] of cases) {
    const index = pkg({ "index.js": `const name = 'a'\n${url(first)}`, "../up.bin": "U", "a.bin": "A" });
    const r = bundledFiles([index, `${index}?commonjs-proxy`, "\0virtual"]);
    expect(r.problems, first).toEqual([`E1014 node_modules/p/index.js ${message}`]);
  }
});

it("two package files naming one path for different files is one E1014; for one file or equal bytes, one copy", () => {
  const index = pkg({ "index.js": url("'x.bin'"), "x.bin": "1", "lib/deep.js": url("'x.bin'"), "lib/x.bin": "2" });
  const deep = path.join(path.dirname(index), "lib", "deep.js");
  const r = bundledFiles([index, deep]);
  expect(r.problems).toEqual([
    "E1014 node_modules/p/lib/deep.js reads x.bin, as node_modules/p/index.js reads another file",
  ]);
  fs.writeFileSync(path.join(path.dirname(index), "lib", "x.bin"), "1");
  expect(bundledFiles([index, deep])).toEqual({
    copies: [{ from: path.join(path.dirname(index), "x.bin"), rel: "x.bin" }],
    problems: [],
  });
});

/** A library's folder at `at` (under `root`): `src/store.js` reading `data.bin` beside it, holding `bytes`. */
function libraryAt(at: string, bytes: string): string {
  fs.mkdirSync(path.join(at, "src"), { recursive: true });
  fs.writeFileSync(path.join(at, "src", "store.js"), url("'data.bin'"));
  fs.writeFileSync(path.join(at, "src", "data.bin"), bytes);
  return path.join(at, "src", "store.js");
}

it("a library's file is read wherever its real folder is: installed, linked through node_modules, or inside the project", () => {
  fc.assert(
    fc.property(fc.constantFrom("installed" as const, "linked" as const, "project" as const), (where) => {
      const app = fs.mkdtempSync(path.join(root, "app-"));
      const real =
        where === "installed"
          ? path.join(app, "node_modules", "@acme", "store")
          : where === "linked"
            ? fs.mkdtempSync(path.join(root, "workspace-"))
            : path.join(app, "libs", "store");
      const file = libraryAt(real, "D");
      if (where === "linked") {
        fs.mkdirSync(path.join(app, "node_modules", "@acme"), { recursive: true });
        fs.symlinkSync(real, path.join(app, "node_modules", "@acme", "store"));
      }
      const libraries = [{ name: "@acme/store", dir: real }];
      expect(bundledFiles([file], libraries)).toEqual({
        copies: [{ from: path.join(real, "src", "data.bin"), rel: "data.bin" }],
        problems: [],
      });
      fs.rmSync(path.join(real, "src", "data.bin"));
      expect(bundledFiles([file], libraries).problems).toEqual([
        "E1014 node_modules/@acme/store/src/store.js reads data.bin, which is missing",
      ]);
      if (where !== "installed") expect(bundledFiles([file]).problems).toEqual([]);
    }),
    { seed: 1337, numRuns: 6 },
  );
});

it("two libraries shipping a file of one name with other bytes is one E1014; with equal bytes, one copy", () => {
  const a = fs.mkdtempSync(path.join(root, "a-"));
  const b = fs.mkdtempSync(path.join(root, "b-"));
  const libraries = [
    { name: "@acme/a", dir: a },
    { name: "@acme/b", dir: b },
  ];
  const ids = [libraryAt(a, "1"), libraryAt(b, "2")];
  expect(bundledFiles(ids, libraries)).toEqual({
    copies: [{ from: path.join(a, "src", "data.bin"), rel: "data.bin" }],
    problems: [
      "E1014 node_modules/@acme/b/src/store.js reads data.bin, as node_modules/@acme/a/src/store.js reads another file",
    ],
  });
  fs.writeFileSync(path.join(b, "src", "data.bin"), "1");
  expect(bundledFiles(ids, libraries).problems).toEqual([]);
});
