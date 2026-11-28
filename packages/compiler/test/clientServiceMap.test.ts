// The client build's service map (k.hosting Peers, k.bundle E1011): the entry maps the modules of every deployable the
// browser code imports, and the build fails when the bundler's graph holds a file of a module the map leaves out.
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unmappedModule } from "../src/internal/unmappedModule.ts";
import keel from "../src/vite.ts";

describe("unmappedModule", () => {
  const moduleOf = (id: string): string | undefined => /^\/modules\/([^/]+)\//.exec(id)?.[1];
  it("names the first bundled file of an unmapped module and its importer", () => {
    const ids = ["/modules/web/a.ts", "/modules/api/c.ts", "/modules/zed/z.ts"];
    const got = unmappedModule(
      ids,
      moduleOf,
      new Set(["web"]),
      () => false,
      (id) => (id.includes("api") ? ["/modules/api/d.ts", "/modules/web/a.ts"] : []),
    );
    expect(got).toEqual({ module: "api", importer: "/modules/web/a.ts" });
  });
  it("is undefined when every module is mapped or the file is skipped", () => {
    const ids = ["/modules/web/a.ts", "/modules/api/c.ts"];
    expect(
      unmappedModule(
        ids,
        moduleOf,
        new Set(["web", "api"]),
        () => false,
        () => [],
      ),
    ).toBeUndefined();
    expect(
      unmappedModule(
        ids,
        moduleOf,
        new Set(["web"]),
        (id) => id.includes("api"),
        () => [],
      ),
    ).toBeUndefined();
  });
});

describe("the client build's service map", () => {
  let root = "";
  const put = (f: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  };
  beforeEach(() => {
    root = tempDir("keel-svcmap-");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const setup = (web: string): ReturnType<typeof keel> => {
    put(
      "topology.ts",
      `import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["web"], adapter: "client" }, srv: { modules: ["api"], adapter: "node" }, st: { modules: ["other"], adapter: "static" } });\n`,
    );
    put("modules/web/routes.ts", "export default [];\n");
    put("modules/web/a.ts", web);
    put("modules/api/x.ts", "export const x = 1;\n");
    put("modules/other/y.ts", "export const y = 1;\n");
    const p = keel();
    p.configResolved({ root, command: "build" });
    return p;
  };
  const entry = async (p: ReturnType<typeof keel>): Promise<string> => {
    const out = await p.load("/@keel/entry.ts?d=web", { ssr: false });
    return typeof out === "string" ? out : "";
  };
  const finish = (p: ReturnType<typeof keel>, ids: string[], importer: string): void => {
    p.buildEnd.call(
      {
        environment: { config: { consumer: "client" } },
        getModuleIds: () => ids,
        getModuleInfo: (id: string) => ({
          isEntry: false,
          importedIds: [],
          dynamicallyImportedIds: [],
          importers: [id.includes("other") ? importer : ""],
        }),
      },
      undefined,
    );
  };

  it("fails with E1011 naming the module and the importing file when the bundle holds a module the entry leaves out", async () => {
    const p = setup(`import { x } from "../api/x.ts";\n`);
    expect(await entry(p)).toContain("api");
    const a = path.join(root, "modules/web/a.ts");
    expect(() => finish(p, [a, path.join(root, "modules/api/x.ts"), path.join(root, "modules/other/y.ts")], a)).toThrow(
      "E1011 other is not in the client's service map: imported by modules/web/a.ts",
    );
  });

  it("passes when every bundled module is mapped, and a static deployable's module is mapped as before", async () => {
    const p = setup(`import { x } from "../api/x.ts";\nimport { y } from "../other/y.ts";\n`);
    const code = await entry(p);
    expect(code).toContain("api");
    expect(code).toContain("other");
    const a = path.join(root, "modules/web/a.ts");
    expect(() =>
      finish(p, [a, path.join(root, "modules/api/x.ts"), path.join(root, "modules/other/y.ts")], a),
    ).not.toThrow();
  });

  it("an aliased import maps nothing, so its module is E1011", async () => {
    const p = setup(`import { y } from "@/other/y.ts";\n`);
    expect((await entry(p)).includes("other")).toBe(false);
    const a = path.join(root, "modules/web/a.ts");
    expect(() => finish(p, [a, path.join(root, "modules/other/y.ts")], a)).toThrow(/^E1011 other /);
  });

  it("reads the peers' keel-peer tags when the topology has a node deployable, though no module of it is called", async () => {
    const code = await entry(setup("export const a = 1;\n"));
    expect(code).toContain('meta[name="keel-peer"]');
    expect(code).toContain('Symbol.for("keel.modules")');
    expect(code.includes('"api"')).toBe(false);
    expect(code.includes('"other"')).toBe(false);
  });
});
