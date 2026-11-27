// k.topology Route table: a stdlib module's routes are its package's `./routes` export, resolved by Node's `exports`
// rule. Examples only: fixed manifests in a temp dir. No random inputs (a fast-check seed would be 1337).
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { entryOf } from "../src/internal/entryOf.ts";

let root = "";
const pkg = (): string => path.join(root, "node_modules", "dep");

/** Writes the package with `exports` and the files `files` (relative to the package). */
const place = (exports: unknown, files: string[]): void => {
  for (const f of ["package.json", ...files]) {
    const file = path.join(pkg(), f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, f === "package.json" ? JSON.stringify({ name: "dep", type: "module", exports }) : "");
  }
};
/** The resolved file of `sub`, relative to the package. */
const at = (sub: string): string | undefined => {
  const r = entryOf(root, "dep", sub);
  return r === undefined ? undefined : path.relative(r[1], r[0]).split(path.sep).join("/");
};

beforeEach(() => {
  root = fs.realpathSync(tempDir(".tmp-entry-of-", import.meta.dirname));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("entryOf subpaths", () => {
  it("resolves an exact key, with and without conditions", () => {
    place({ ".": "./src/index.ts", "./routes": { default: "./src/routes.ts" }, "./plain": "./src/plain.ts" }, [
      "src/index.ts",
      "src/routes.ts",
      "src/plain.ts",
    ]);
    expect(at("./routes")).toBe("src/routes.ts");
    expect(at("./plain")).toBe("src/plain.ts");
    expect(at(".")).toBe("src/index.ts");
    expect(entryOf(root, "dep", "./routes")?.[1]).toBe(fs.realpathSync(pkg()));
  });

  it("resolves a pattern, substituting what the star matched", () => {
    place({ "./*": "./src/*.ts" }, ["src/routes.ts", "src/deep/routes.ts"]);
    expect(at("./routes")).toBe("src/routes.ts");
    expect(at("./deep/routes")).toBe("src/deep/routes.ts");
  });

  it("resolves a pattern under conditions in the order node, import, default", () => {
    place({ "./*": { types: "./types/*.d.ts", import: "./esm/*.js", default: "./cjs/*.js" } }, [
      "types/routes.d.ts",
      "esm/routes.js",
      "cjs/routes.js",
    ]);
    expect(at("./routes")).toBe("esm/routes.js");
  });

  it("resolves a pattern with an extension suffix only for subpaths that carry it", () => {
    place({ "./*.js": "./src/*.ts" }, ["src/routes.ts"]);
    expect(at("./routes.js")).toBe("src/routes.ts");
    expect(at("./routes")).toBeUndefined();
  });

  it("prefers an exact key to a pattern", () => {
    place({ "./*": "./any/*.ts", "./routes": "./src/routes.ts" }, ["any/routes.ts", "src/routes.ts"]);
    expect(at("./routes")).toBe("src/routes.ts");
  });

  it("prefers the pattern with the longest prefix, whatever the key order", () => {
    const files = ["any/feat/routes.ts", "feat/routes.ts"];
    place({ "./*": "./any/*.ts", "./feat/*": "./feat/*.ts" }, files);
    expect(at("./feat/routes")).toBe("feat/routes.ts");
    place({ "./feat/*": "./feat/*.ts", "./*": "./any/*.ts" }, files);
    expect(at("./feat/routes")).toBe("feat/routes.ts");
  });

  it("prefers the longer key among patterns with one prefix", () => {
    place({ "./*": "./any/*", "./*.js": "./src/*.ts" }, ["any/routes.js", "src/routes.ts"]);
    expect(at("./routes.js")).toBe("src/routes.ts");
  });

  it("excludes a null target, exact or pattern, without falling back to a shorter pattern", () => {
    place({ "./*": "./src/*.ts", "./internal/*": null, "./routes": null }, ["src/routes.ts", "src/internal/x.ts"]);
    expect(at("./routes")).toBeUndefined();
    expect(at("./internal/x")).toBeUndefined();
    expect(at("./other")).toBeUndefined();
  });

  it("gives undefined for a subpath no key matches, a missing file, or exports that are not a subpath map", () => {
    place({ ".": "./src/index.ts", "./feat/*": "./feat/*.ts" }, ["src/index.ts"]);
    expect(at("./routes")).toBeUndefined();
    expect(at("./feat/routes")).toBeUndefined();
    place("./src/index.ts", ["src/index.ts"]);
    expect(at("./routes")).toBeUndefined();
  });

  it("refuses a pattern match that leaves the package", () => {
    place({ "./*": "./src/*.ts" }, ["routes.ts"]);
    expect(at("./../routes")).toBeUndefined();
  });

  it("substitutes a match holding `$` literally", () => {
    place({ "./*": "./src/*.ts" }, ["src/$&.ts"]);
    expect(at("./$&")).toBe("src/$&.ts");
  });
});
