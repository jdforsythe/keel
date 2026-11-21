// k.compiler Artifacts: a placed module that resolves to no app folder and no stdlib package is named unread
// (W1005) by routeLiterals, never dropped; a stdlib module without `./routes` is no such module. Seed 1337.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unreadModules } from "../src/internal/unreadModules.ts";
import { routeLiterals } from "../src/routeLiterals.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

let root = "";
const put = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const MOD = `export default module({ id: "m", deps: ["@keel/std-x"], capabilities: [], public: { exports: [] } });\n`;
const files: SourceFile[] = [
  { path: "modules/m/module.ts", source: MOD },
  {
    path: "modules/m/m.contract.ts",
    source: `import { contract } from "@keel/router/contract";\nexport const m = contract("m", { "m.home": { path: "/" } });\n`,
  },
  {
    path: "modules/m/routes.ts",
    source: `import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\nexport const routes = manifest(m, { "m.home": { component: C } });\n`,
  },
  { path: "modules/n/module.ts", source: MOD.replace('"m"', '"n"') },
];
const node = (modules: string[]) => ({ web: { modules, adapter: "node" as const } });

beforeEach(() => {
  root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "keel-unread-"));
  for (const f of files) put(f.path, f.source);
  put("node_modules/@keel/std-x/package.json", JSON.stringify({ exports: { "./module": "./module.ts" } }));
  put("node_modules/@keel/std-x/module.ts", `export default module({ id: "x", capabilities: [] });\n`);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("unreadModules", () => {
  it("names a placed id with no app folder and no stdlib package", () => {
    expect(
      unreadModules(
        node(["m", "ghost"]),
        files.map((f) => f.path),
        root,
      ),
    ).toEqual(["ghost"]);
  });

  it("does not name an app module without routes.ts or a stdlib module without ./routes", () => {
    expect(
      unreadModules(
        node(["m", "n", "x"]),
        files.map((f) => f.path),
        root,
      ),
    ).toEqual([]);
  });

  it("routeLiterals opens the id set and names the id, keeping the routes it read", () => {
    const r = routeLiterals(files, { topology: node(["m", "ghost"]), root });
    expect(r?.closed).toBe(false);
    expect(r?.unread).toEqual(["ghost"]);
    expect(Object.keys(r?.routes ?? {})).toEqual(["m.home"]);
    expect(routeLiterals(files, { topology: node(["m", "x"]), root })?.closed).toBe(true);
  });
});
