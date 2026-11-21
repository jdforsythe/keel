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
