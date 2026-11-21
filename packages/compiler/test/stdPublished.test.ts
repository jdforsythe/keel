// A std package resolves its module manifest through its `./module` export, so a package installed with only its
// published file set (`dist`, `docs`) still serves its routes. Examples only: fixed projects in a temp dir.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stdModuleDir } from "../src/internal/stdModuleDir.ts";
import { stdRoutes } from "../src/std/stdRoutes.ts";

// Real packages dir via a workspace link, so this also holds in Stryker's sandbox copy.
const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
const STD = ["channels", "health", "jobs", "schedules", "sessions", "workflows"];
let root = "";

const write = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const manifest = (id: string): string =>
  `export default { id: "${id}", deps: [], capabilities: [], public: { exports: [] } };\n`;

/** The package.json of std package `name` in the repo, parsed. */
const repoPackage = (name: string): { files: string[]; publishConfig: { exports: Record<string, unknown> } } =>
  JSON.parse(fs.readFileSync(path.join(packages, `std-${name}`, "package.json"), "utf8"));

/** The file a `publishConfig.exports` entry's `default` names. */
const targetOf = (entry: unknown): string => {
  const value = typeof entry === "object" && entry !== null ? Reflect.get(entry, "default") : undefined;
  return typeof value === "string" ? value : "";
};

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-std-published-")));
  write(
    "modules/app/module.ts",
    'export default { id: "app", deps: ["@keel/std-pub"], capabilities: [], public: { exports: [] } };\n',
  );
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("a std package installed from its published files", () => {
  const install = (files: Record<string, string>): void => {
    write(
      "node_modules/@keel/std-pub/package.json",
      JSON.stringify({
        name: "@keel/std-pub",
        type: "module",
        exports: {
          "./module": { default: "./dist/module.js" },
          "./routes": { default: "./dist/src/routes.js" },
        },
        files: ["dist", "docs"],
      }),
    );
    for (const [rel, text] of Object.entries(files)) write(`node_modules/@keel/std-pub/${rel}`, text);
  };

  it("is found through its ./module export when only dist ships", () => {
    install({ "dist/module.js": manifest("pub"), "dist/src/routes.js": "export const routes = {};\n" });
    const dir = fs.realpathSync(path.join(root, "node_modules/@keel/std-pub"));
    expect(stdModuleDir(root, "pub")).toBe(dir);
    expect(stdRoutes(root, "pub")).toEqual([path.join(dir, "dist/src/routes.js"), dir, "@keel/std-pub/routes"]);
  });

  it("is not found when the package ships no manifest file", () => {
    install({ "dist/src/routes.js": "export const routes = {};\n" });
    expect(stdModuleDir(root, "pub")).toBeUndefined();
    expect(stdRoutes(root, "pub")).toBeUndefined();
  });
});

describe.each(STD)("@keel/std-%s publish shape", (name) => {
  const pkg = repoPackage(name);

  it("publishes every export and the ./module manifest from dist", () => {
    const published = pkg.publishConfig.exports;
    expect(Object.keys(published)).toContain("./module");
    for (const entry of Object.values(published)) expect(targetOf(entry)).toMatch(/^\.\/dist\/.+\.js$/);
    expect(pkg.files).toContain("dist");
    expect(targetOf(published["./module"])).toBe("./dist/module.js");
  });

  it("builds module.ts into dist", () => {
    const build = fs.readFileSync(path.join(packages, `std-${name}`, "tsconfig.build.json"), "utf8");
    expect(build).toContain('"module.ts"');
  });

  it("resolves its module through the published exports from a fixture of the packed file set", () => {
    const dir = path.join(root, "node_modules", "@keel", `std-${name}`);
    fs.mkdirSync(dir, { recursive: true });
    write(
      `node_modules/@keel/std-${name}/package.json`,
      JSON.stringify({ name: `@keel/std-${name}`, type: "module", exports: pkg.publishConfig.exports }),
    );
    const source = fs.readFileSync(path.join(packages, `std-${name}`, "module.ts"), "utf8");
    write(`node_modules/@keel/std-${name}/dist/module.js`, source);
    write(
      "modules/app/module.ts",
      `export default { id: "app", deps: ["@keel/std-${name}"], capabilities: [], public: { exports: [] } };\n`,
    );
    const id = /id: "([^"]+)"/.exec(source)?.[1] ?? "";
    expect(stdModuleDir(root, id)).toBe(fs.realpathSync(dir));
  });
});
