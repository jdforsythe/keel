// The plugin's `config` hook (k.server Build, RFC 0048): a `vite build` whose KEEL_DEPLOYABLE is a node deployable
// builds the resume entry alone into dist/<name>/ with the client manifest; a client deployable's build keeps the
// project config with its output in dist/<name>/ (k.hosting Artifact); every other run keeps the project config.
import fs from "node:fs";
import path from "node:path";
import { CLIENT_MANIFEST } from "@keel/compiler/internal/entry/CLIENT_MANIFEST";
import { ENTRY_PATH } from "@keel/compiler/internal/entry/ENTRY_PATH";
import keel from "@keel/compiler/vite";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** What the plugin's `config` always gives: the locked `envPrefix` and the worker bundles' plugin. */
/** Every config the plugin returns: the app's libraries are never pre-bundled or left to Node (none here). */
const SERVE = {
  envPrefix: "\0",
  worker: { plugins: expect.any(Function) },
  ssr: { noExternal: [] },
  optimizeDeps: { exclude: [] },
};
/** A build defines `DEV` and `PROD` itself, whatever the project config sets `process.env.NODE_ENV` to. */
const OWN = { ...SERVE, define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" } };

let root = "";
const saved = process.env.KEEL_DEPLOYABLE;
beforeEach(() => {
  root = tempDir(".tmp-client-build-", import.meta.dirname);
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
    const made = keel().config({ root }, { command: "build" });
    const config = made !== null && "builder" in made ? made : undefined;
    expect(config?.build).toEqual({
      outDir: "dist/api",
      emptyOutDir: true,
      manifest: CLIENT_MANIFEST,
      rolldownOptions: { input: { entry: ENTRY_PATH } },
    });
    expect(config?.environments.ssr).toEqual({
      resolve: { noExternal: true },
      build: {
        outDir: "dist/api",
        emptyOutDir: false,
        manifest: false,
        copyPublicDir: false,
        sourcemap: true,
        rolldownOptions: {
          input: "virtual:keel/server",
          output: {
            entryFileNames: "server.mjs",
            codeSplitting: false,
            sourcemapExcludeSources: true,
            sourcemapPathTransform: expect.any(Function),
          },
        },
      },
    });
    expect(config?.builder.buildApp).toBeTypeOf("function");
    expect(CLIENT_MANIFEST).toBe(".vite/manifest.json");
  });

  it("builds a client deployable into dist/<name>/ with the project config", () => {
    process.env.KEEL_DEPLOYABLE = "web";
    expect(keel().config({ root }, { command: "build" })).toEqual({
      ...OWN,
      build: { outDir: "dist/web", emptyOutDir: true },
    });
  });

  it("defines import.meta.env.DEV false and PROD true for every build, not for serve", () => {
    expect(keel().config({ root }, { command: "build" })).toMatchObject({
      define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" },
    });
    expect(keel().config({ root }, { command: "serve" })).not.toHaveProperty("define");
  });

  it("keeps the project config for serve, ssr, unknown or unset deployables, or no topology", () => {
    process.env.KEEL_DEPLOYABLE = "api";
    expect(keel().config({ root }, { command: "serve" })).toEqual(SERVE);
    expect(keel().config({ root }, { command: "build", isSsrBuild: true })).toEqual(OWN);
    process.env.KEEL_DEPLOYABLE = "nope";
    expect(keel().config({ root }, { command: "build" })).toEqual(OWN);
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    expect(keel().config({ root }, { command: "build" })).toEqual(OWN);
    process.env.KEEL_DEPLOYABLE = "api";
    expect(keel().config({ root: path.join(root, "missing") }, { command: "build" })).toEqual(OWN);
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
    const spy = vi.spyOn(process, "cwd").mockReturnValue(root);
    try {
      const made = keel().config({}, { command: "build" });
      expect("build" in made ? made.build.outDir : undefined).toBe("dist/api");
    } finally {
      spy.mockRestore();
    }
  });
});
