// The plugin's `config` hook (k.server Build, RFC 0048): a `vite build` whose KEEL_DEPLOYABLE is a node deployable
// builds the resume entry alone into dist/<name>/ with the client manifest; every other run keeps the project config.
import fs from "node:fs";
import path from "node:path";
import { CLIENT_MANIFEST } from "@keel/compiler/entry/CLIENT_MANIFEST";
import { ENTRY_PATH } from "@keel/compiler/entry/ENTRY_PATH";
import keel from "@keel/compiler/vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root = "";
const saved = process.env.KEEL_DEPLOYABLE;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-client-build-"));
  fs.writeFileSync(
    path.join(root, "topology.ts"),
    'export default topology({ api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client" }, pre: { modules: ["p"], adapter: "static" } })\n',
  );
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
  else process.env.KEEL_DEPLOYABLE = saved;
});

describe("@keel/compiler/vite config (client build of a node deployable)", () => {
  it("builds the resume entry alone into dist/<name>/ with the manifest for a node KEEL_DEPLOYABLE", () => {
    process.env.KEEL_DEPLOYABLE = "api";
    expect(keel().config({ root }, { command: "build" })).toEqual({
      build: {
        outDir: "dist/api",
        emptyOutDir: true,
        manifest: CLIENT_MANIFEST,
        rolldownOptions: { input: { entry: ENTRY_PATH } },
      },
    });
    expect(CLIENT_MANIFEST).toBe(".vite/manifest.json");
  });

  it("keeps the project config for serve, ssr, client, static, unknown or unset deployables, or no topology", () => {
    process.env.KEEL_DEPLOYABLE = "api";
    expect(keel().config({ root }, { command: "serve" })).toBeNull();
    expect(keel().config({ root }, { command: "build", isSsrBuild: true })).toBeNull();
    for (const name of ["web", "pre", "nope"]) {
      process.env.KEEL_DEPLOYABLE = name;
      expect(keel().config({ root }, { command: "build" })).toBeNull();
    }
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    expect(keel().config({ root }, { command: "build" })).toBeNull();
    process.env.KEEL_DEPLOYABLE = "api";
    expect(keel().config({ root: path.join(root, "missing") }, { command: "build" })).toBeNull();
  });

  it("writes no .keel artifacts in a node client build; the project's own build still does", () => {
    process.env.KEEL_DEPLOYABLE = "api";
    const node = keel();
    node.config({ root }, { command: "build" });
    node.configResolved({ root, command: "build" });
    node.transform("export default function A() { return <p>a</p> }", path.join(root, "modules/a/A.tsx"));
    expect(fs.existsSync(path.join(root, ".keel", "ids.json"))).toBe(false);
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    const own = keel();
    own.config({ root }, { command: "build" });
    own.configResolved({ root, command: "build" });
    own.transform("export default function A() { return <p>a</p> }", path.join(root, "modules/a/A.tsx"));
    expect(fs.existsSync(path.join(root, ".keel", "ids.json"))).toBe(true);
  });

  it("resolves the topology from the working directory when the config has no root", () => {
    process.env.KEEL_DEPLOYABLE = "api";
    const cwd = process.cwd();
    process.chdir(root);
    try {
      expect(keel().config({}, { command: "build" })?.build.outDir).toBe("dist/api");
    } finally {
      process.chdir(cwd);
    }
  });
});
