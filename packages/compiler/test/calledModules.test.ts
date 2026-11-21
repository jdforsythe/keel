import { describe, expect, it } from "vitest";
import { calledModules } from "../src/internal/calledModules.ts";

const fake = (tree: Record<string, string>) => ({
  read: (f: string): string | undefined => tree[f],
  list: (dir: string): string[] => {
    const names = new Set<string>();
    for (const f of Object.keys(tree))
      if (f.startsWith(`${dir}/`)) names.add(f.slice(dir.length + 1).split("/")[0] ?? "");
    return [...names];
  },
});

describe("calledModules", () => {
  it("names the modules the browser files import, through shared files, and skips server-only files", () => {
    const tree = {
      "modules/web/Page.tsx": `import { api } from "./client.ts";\nimport "../shared/x.ts";`,
      "modules/web/client.ts": `import { c } from "../api/api.contract.ts";`,
      "modules/web/load.server.ts": `import { s } from "../secretmod/s.ts";`,
      "modules/shared/x.ts": `export * from "../deep/index.ts"; const l = () => import("../lazy/mod");`,
      "modules/api/api.contract.ts": "export const c = 1;",
      "modules/deep/index.ts": "",
      "modules/lazy/mod.ts": "",
      "modules/secretmod/s.ts": "",
      "modules/unrelated/u.ts": "",
    };
    expect(calledModules(["web"], fake(tree))).toEqual(["api", "deep", "lazy", "shared"]);
  });

  it("returns nothing when no file imports another module", () => {
    expect(calledModules(["web"], fake({ "modules/web/a.ts": `import "./b.ts";`, "modules/web/b.ts": "" }))).toEqual(
      [],
    );
  });
});

describe("calledModules, what the scan reads", () => {
  const web = (text: string, extra: Record<string, string> = {}): string[] =>
    calledModules(["web"], fake({ "modules/web/a.ts": text, "modules/api/api.contract.ts": "", ...extra }));

  it("skips a type-only import and export, a specifier in a line or block comment", () => {
    expect(web(`import type { T } from "../api/api.contract.ts";`)).toEqual([]);
    expect(web(`export type { T } from "../api/api.contract.ts";`)).toEqual([]);
    expect(web(`// import { c } from "../api/api.contract.ts";`)).toEqual([]);
    expect(web(`/* import { c } from "../api/api.contract.ts";\n */ export const x = 1;`)).toEqual([]);
  });

  it("reads a multi-line import and a value import that follows a type import", () => {
    expect(web(`import {\n  a,\n  b,\n} from\n  "../api/api.contract.ts";`)).toEqual(["api"]);
    expect(
      web(`import type { T } from "./t.ts";\nimport { c } from "../api/api.contract.ts";`, { "modules/web/t.ts": "" }),
    ).toEqual(["api"]);
  });

  it("does not follow an alias or a package name: the build's graph check reports those (E1011)", () => {
    expect(web(`import { c } from "@/api/api.contract.ts";\nimport "pkg/api.contract.ts";`)).toEqual([]);
  });

  it("does not follow a computed dynamic import: the bundler's glob of it reaches the graph check (E1011)", () => {
    expect(web("const f = (n: string) => import(`../api/${n}.ts`); const g = (m: string) => import(m);")).toEqual([]);
  });
});
