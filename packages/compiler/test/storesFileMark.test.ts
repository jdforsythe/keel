// k.data Dev: under `keel dev` alone, each app file the server graph loads names itself as its top level begins
// (`storesFileMark`), and the dev server module installs `storesFile` for the marks and ends each load with
// `storesLoaded`, whether it succeeds or throws. A build, a browser transform and a test process mark nothing.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import keel from "@keel/compiler/vite";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORES_FILE_KEY } from "../src/internal/STORES_FILE_KEY.ts";
import { devEntryCode } from "../src/internal/devEntryCode.ts";
import { storesFileMark } from "../src/internal/storesFileMark.ts";

let root = "";
const before = process.env.KEEL_DEV_DIR;
beforeEach(() => {
  root = tempDir(".tmp-stores-mark-", import.meta.dirname);
  fs.writeFileSync(path.join(root, "topology.ts"), `export default { api: { modules: ["a"], adapter: "node" } };\n`);
  fs.mkdirSync(path.join(root, "modules/a"), { recursive: true });
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  if (before === undefined) delete process.env.KEEL_DEV_DIR;
  else process.env.KEEL_DEV_DIR = before;
});

/** The plugin's transform of an app file, served (`serve`) or built, with a dev server whose topology has a `node`. */
const transformed = (command: "serve" | "build", ssr: boolean): string | undefined => {
  const p = keel();
  p.configResolved({ root, command });
  p.configureServer({
    moduleGraph: { getModuleById: () => undefined },
    reloadModule: () => Promise.resolve(),
    ssrLoadModule: () => Promise.resolve({}),
    middlewares: { use: () => undefined },
  });
  const file = path.join(root, "modules/a/x.ts");
  return p.transform("export const n = 1;\n", file, { ssr })?.code;
};

describe("storesFileMark", () => {
  it("is one line calling the installed `storesFile` with the file, or nothing when none is installed", () => {
    const mark = storesFileMark("/p/modules/a/x.ts");
    expect(mark).not.toContain("\n");
    const seen: unknown[] = [];
    const key = Symbol.for(STORES_FILE_KEY);
    const run = (): void => {
      // The mark is plain JavaScript, run here in this realm as the module it begins would run it.
      vm.runInThisContext(mark);
    };
    run();
    Reflect.set(globalThis, key, (f: unknown) => seen.push(f));
    try {
      run();
    } finally {
      Reflect.deleteProperty(globalThis, key);
    }
    expect(seen).toEqual(["/p/modules/a/x.ts"]);
  });

  it("begins an app file's SSR transform under `keel dev` alone, keeping its line count", () => {
    const file = path.join(root, "modules/a/x.ts");
    process.env.KEEL_DEV_DIR = path.join(root, ".keel-dev");
    const dev = transformed("serve", true);
    expect(dev?.startsWith(storesFileMark(file))).toBe(true);
    expect(dev?.split("\n").length).toBe("export const n = 1;\n".split("\n").length);
    expect(transformed("serve", false) ?? "").not.toContain(STORES_FILE_KEY);
    expect(transformed("build", true) ?? "").not.toContain(STORES_FILE_KEY);
    delete process.env.KEEL_DEV_DIR;
    expect(transformed("serve", true) ?? "").not.toContain(STORES_FILE_KEY);
  });
});

describe("the dev server module's store load", () => {
  it("starts with storesReload and the installed storesFile, and ends in a finally with storesLoaded", () => {
    const code = devEntryCode("/p", { api: { modules: ["a"], adapter: "node" } });
    expect(code).toContain('import { storesFile, storesLoaded, storesReload } from "@keel/store/internal";');
    const reload = code.indexOf("storesReload();");
    const install = code.indexOf(`globalThis[Symbol.for("${STORES_FILE_KEY}")] = storesFile;`);
    const open = code.indexOf("try {");
    const firstImport = code.indexOf("await import(");
    expect(reload).toBeGreaterThan(0);
    expect(install).toBeGreaterThan(reload);
    expect(open).toBeGreaterThan(install);
    expect(firstImport).toBeGreaterThan(open);
    expect(code.trimEnd().endsWith("} finally {\n  storesLoaded();\n}")).toBe(true);
    expect(code.indexOf("export const apps = [];")).toBeLessThan(open);
  });
});
