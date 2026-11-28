import { describe, expect, it } from "vitest";
import {
  builtPath,
  inTarball,
  rewriteExports,
  rootSources,
  stagedManifest,
  tarballFindings,
  targets,
  typesPath,
} from "../../evals/public/pack.ts";

describe("pack rewrite", () => {
  it("points source targets at their built files", () => {
    expect(
      rewriteExports({
        ".": { types: "./src/index.ts", default: "./src/index.ts" },
        "./module": { default: "./module.ts" },
        "./x": "./src/x.mts",
      }),
    ).toEqual({
      ".": { types: "./dist/src/index.d.ts", default: "./dist/src/index.js" },
      "./module": { default: "./dist/module.js" },
      "./x": "./dist/src/x.mjs",
    });
  });

  it("leaves a declaration file where it is, under every condition", () => {
    expect(
      rewriteExports({
        "./client": { types: "./src/client.d.ts" },
        "./jsx-runtime": { types: "./jsx-runtime.d.ts" },
        "./m": { types: "./m.d.mts", default: "./m.d.cts" },
      }),
    ).toEqual({
      "./client": { types: "./src/client.d.ts" },
      "./jsx-runtime": { types: "./jsx-runtime.d.ts" },
      "./m": { types: "./m.d.mts", default: "./m.d.cts" },
    });
    for (const d of ["./src/client.d.ts", "./jsx-runtime.d.ts", "./a.d.mts", "./a.d.cts"]) {
      expect(typesPath(d)).toBeUndefined();
      expect(builtPath(d)).toBeUndefined();
    }
  });

  it("never gives a target a second `.d`", () => {
    for (const t of ["./src/a.ts", "./src/a.d.ts", "./b.tsx", "./c.mts", "./c.d.mts", "./src/x.d.ts.ts"]) {
      const out = rewriteExports({ types: t, default: t });
      expect(JSON.stringify(out)).not.toMatch(/\.d\.d\./);
    }
  });

  it("compiles root sources but not root declaration files", () => {
    expect(rootSources({ a: "./module.ts", b: "./jsx-runtime.d.ts", c: "./src/x.ts", d: "./m.d.mts" })).toEqual([
      "./module.ts",
    ]);
  });

  it("stages the rewritten exports", () => {
    expect(stagedManifest({ name: "@keel/x", exports: { "./client": { types: "./src/client.d.ts" } } })).toEqual({
      name: "@keel/x",
      exports: { "./client": { types: "./src/client.d.ts" } },
    });
  });

  it("stages `publishConfig.exports` when the package has it, a `null` subpath included", () => {
    const staged = stagedManifest({
      name: "@keel/x",
      exports: { ".": "./src/index.ts", "./testing": "./src/testing/a.ts" },
      publishConfig: { exports: { ".": "./dist/src/index.js", "./testing": null } },
    });
    expect(staged).toEqual({ name: "@keel/x", exports: { ".": "./dist/src/index.js", "./testing": null } });
  });
});

describe("pack lint", () => {
  const files = new Set(["package.json", "dist/src/index.js", "dist/src/index.d.ts", "dist/src/std/a.js"]);
  const nowhere = (): boolean => false;

  it("collects targets through conditions and fallback arrays", () => {
    expect(targets({ ".": { types: "./a.d.ts", import: ["./b.js", { default: "./c.js" }] }, x: null })).toEqual([
      "./a.d.ts",
      "./b.js",
      "./c.js",
    ]);
  });

  it("matches plain targets and `*` patterns against the file list", () => {
    expect(inTarball("./dist/src/index.js", files)).toBe(true);
    expect(inTarball("./dist/src/std/*.js", files)).toBe(true);
    expect(inTarball("./dist/src/std/*.d.ts", files)).toBe(false);
    expect(inTarball("./dist/src/client.d.ts", files)).toBe(false);
  });

  it("passes a manifest whose every target is in the tarball", () => {
    const m = {
      exports: {
        ".": { types: "./dist/src/index.d.ts", default: "./dist/src/index.js" },
        "./std/*": "./dist/src/std/*.js",
      },
      bin: { k: "./dist/src/index.js" },
    };
    expect(tarballFindings("packages/x/package.json", m, files, nowhere)).toEqual([]);
  });

  it("flags a missing `types` target: P0003 when the folder has it, P0002 when no build wrote it", () => {
    const m = {
      exports: {
        "./client": { types: "./src/client.d.ts" },
        "./jsx-runtime": { types: "./dist/jsx-runtime.d.d.ts" },
      },
    };
    const found = tarballFindings("packages/x/package.json", m, files, (t) => t === "./src/client.d.ts");
    expect(found.map((d) => [d.code, d.path, d.message])).toEqual([
      [
        "P0003",
        "packages/x/package.json",
        'exports "./client" ./src/client.d.ts is outside `files`, not in the tarball',
      ],
      [
        "P0002",
        "packages/x/package.json",
        'exports "./jsx-runtime" ./dist/jsx-runtime.d.d.ts is not in the tarball; no build wrote it',
      ],
    ]);
  });

  it("flags a string `exports`, a sugar conditions object and a missing bin", () => {
    expect(tarballFindings("p", { exports: "./dist/gone.js" }, files, nowhere).map((d) => d.message)).toEqual([
      "exports ./dist/gone.js is not in the tarball; no build wrote it",
    ]);
    expect(
      tarballFindings("p", { exports: { types: "./dist/gone.d.ts", default: "./dist/src/index.js" } }, files, nowhere),
    ).toHaveLength(1);
    expect(tarballFindings("p", { bin: "./dist/bin.js" }, files, nowhere).map((d) => d.code)).toEqual(["P0002"]);
    expect(tarballFindings("p", { bin: { k: "./dist/bin.js" } }, files, nowhere).map((d) => d.message)).toEqual([
      'bin "k" ./dist/bin.js is not in the tarball; no build wrote it',
    ]);
  });

  it("keeps every message within the output line limit", () => {
    const m = { exports: { "./client": { types: "./src/client.d.ts" } } };
    for (const d of tarballFindings("p", m, files, nowhere)) expect(d.message.length).toBeLessThanOrEqual(89);
  });
});
