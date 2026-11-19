// The shell files and storage-specific deploy files `deployFiles` derives from a topology (k.shell Files, k.deploy).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { deployFiles } from "../src/deployFiles.ts";
import { deployWrites } from "../src/internal/deployWrites.ts";
import { tauriHttpCapability } from "../src/templates/tauriHttpCapability.ts";
import type { DeployTopology } from "../src/types/DeployTopology.ts";

const POLICY = "default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'";
const label = fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/);
const shell = fc.record({
  id: fc.tuple(label, label, label).map((p) => p.join(".")),
  name: fc.stringMatching(/^[A-Z][a-z]{1,8}$/),
});

describe("shell files", () => {
  test("a client declaring both shells gets the Capacitor config and the six Tauri files; a node deployable none", () => {
    fc.assert(
      fc.property(shell, shell, (cap, tau) => {
        const topology: DeployTopology = {
          web: { modules: ["c"], adapter: "client", shells: { capacitor: cap, tauri: tau } },
          api: { modules: ["a"], adapter: "node" },
        };
        const files = deployFiles(topology, { ci: false, version: "2.3.4", crate: "golden-1", policy: POLICY });
        expect(JSON.parse(files.get("deploy/web/capacitor/capacitor.config.json") ?? "")).toEqual({
          appId: cap.id,
          appName: cap.name,
          webDir: "www",
        });
        const conf: unknown = JSON.parse(files.get("deploy/web/tauri/tauri.conf.json") ?? "");
        expect(conf).toEqual({
          productName: tau.name,
          version: "2.3.4",
          identifier: tau.id,
          build: { frontendDist: "www" },
          app: {
            windows: [{ label: "main", title: tau.name }],
            security: {
              csp: "default-src 'none'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost; frame-ancestors 'none'",
            },
          },
          plugins: { "deep-link": { desktop: { schemes: [tau.id] } } },
        });
        const cargo = files.get("deploy/web/tauri/Cargo.toml") ?? "";
        expect(cargo).toContain('name = "golden-1"');
        expect(cargo).toContain('version = "2.3.4"');
        for (const dep of [
          'tauri = { version = "=2.12.5"',
          'tauri-build = { version = "=2.7.4"',
          'tauri-plugin-store = "=2.5.1"',
          'tauri-plugin-http = "=2.9.0"',
        ])
          expect(cargo).toContain(dep);
        for (const p of ["build.rs", "src/main.rs", "src/lib.rs", "capabilities/default.json"])
          expect(files.has(`deploy/web/tauri/${p}`), p).toBe(true);
        expect([...files.keys()].filter((p) => p.startsWith("deploy/api/"))).toEqual(["deploy/api/Dockerfile"]);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test("the plugins of return links and the default browser are in the Tauri files only with identity", () => {
    const topology: DeployTopology = {
      web: { modules: ["c"], adapter: "client", shells: { tauri: { id: "dev.keel.golden", name: "Golden" } } },
    };
    const at = "deploy/web/tauri/";
    const plain = deployFiles(topology, { ci: false, policy: POLICY });
    const signed = deployFiles(topology, { ci: false, policy: POLICY, identity: true });
    const extra = [
      'tauri-plugin-deep-link = "=2.6.3"',
      'tauri-plugin-opener = "=2.7.3"',
      'tauri-plugin-single-instance = { version = "=2.5.5", features = ["deep-link"] }',
    ];
    for (const dep of extra) {
      expect(plain.get(`${at}Cargo.toml`)).not.toContain(dep);
      expect(signed.get(`${at}Cargo.toml`)).toContain(dep);
    }
    const plugins = ["tauri_plugin_single_instance::init", "tauri_plugin_deep_link::init", "tauri_plugin_opener::init"];
    const lib = signed.get(`${at}src/lib.rs`) ?? "";
    for (const plugin of plugins) {
      expect(plain.get(`${at}src/lib.rs`)).not.toContain(plugin);
      expect(lib).toContain(plugin);
    }
    // The single-instance plugin is registered first, so a second launch never starts the others.
    expect(plugins.map((x) => lib.indexOf(x))).toEqual(plugins.map((x) => lib.indexOf(x)).sort((a, b) => a - b));
    const permissions = (files: Map<string, string>): unknown =>
      Reflect.get(Object(JSON.parse(files.get(`${at}capabilities/default.json`) ?? "{}")), "permissions");
    expect(permissions(plain)).toEqual(["core:default", "store:default"]);
    expect(permissions(signed)).toEqual([
      "core:default",
      "store:default",
      "deep-link:default",
      { identifier: "opener:allow-open-url", allow: [{ url: "https://*" }] },
    ]);
    // The scheme is registered either way.
    expect(plain.get(`${at}tauri.conf.json`)).toBe(signed.get(`${at}tauri.conf.json`));
  });

  test("the build's http capability lets the default browser open KEEL_ORIGIN only with identity", () => {
    const http = { identifier: "http:default", allow: [{ url: "http://localhost:8787/*" }] };
    const opener = { identifier: "opener:allow-open-url", allow: [{ url: "http://localhost:8787/*" }] };
    const permissions = (text: string): unknown => Reflect.get(Object(JSON.parse(text)), "permissions");
    expect(permissions(tauriHttpCapability("http://localhost:8787"))).toEqual([http]);
    expect(permissions(tauriHttpCapability("http://localhost:8787", true))).toEqual([http, opener]);
  });

  test("a tree with identity.ts gets the Tauri files with the plugins; without it, without them", () => {
    const tree = new Map([
      [
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } } })\n",
      ],
      ["package.json", '{ "name": "fx", "version": "1.0.0" }'],
    ]);
    const cargo = (files: Map<string, string>): string =>
      deployWrites(files, true).get("deploy/web/tauri/Cargo.toml") ?? "";
    expect(cargo(tree)).not.toContain("tauri-plugin-deep-link");
    expect(cargo(new Map([...tree, ["identity.ts", ""]]))).toContain("tauri-plugin-deep-link");
  });

  test("without a policy there is no tauri.conf.json; shells on a node or static deployable write nothing", () => {
    const tauri = { id: "dev.keel.golden", name: "Golden" };
    const files = deployFiles(
      {
        web: { modules: ["c"], adapter: "client", shells: { tauri } },
        api: { modules: ["a"], adapter: "node", shells: { tauri } },
        docs: { modules: ["d"], adapter: "static", shells: { tauri } },
      },
      { ci: false },
    );
    expect(files.has("deploy/web/tauri/tauri.conf.json")).toBe(false);
    expect(files.get("deploy/web/tauri/Cargo.toml")).toContain('version = "0.0.0"');
    expect([...files.keys()].filter((p) => p.includes("/tauri/") && !p.startsWith("deploy/web/"))).toEqual([]);
  });

  test("the CI workflow gains a Tauri job and Android and manual iOS jobs on the deployable's paths", () => {
    const shells = {
      tauri: { id: "dev.keel.golden", name: "Golden" },
      capacitor: { id: "dev.keel.golden", name: "Golden" },
    };
    const ci = deployFiles({ web: { modules: ["c"], adapter: "client", shells } }, { ci: true, crate: "golden-1" }).get(
      ".github/workflows/ci.yml",
    );
    expect(ci).toContain("  web-tauri:");
    expect(ci).toContain("pnpm exec keel build --target tauri");
    expect(ci).toContain("path: dist/web/tauri/target/debug/golden-1");
    expect(ci).toContain("pnpm exec keel build --target capacitor --platform android");
    expect(ci).toContain("github.event_name == 'workflow_dispatch'");
    expect(ci).toContain("  workflow_dispatch: {}");
    const plain = deployFiles({ web: { modules: ["c"], adapter: "client" } }, { ci: true }).get(
      ".github/workflows/ci.yml",
    );
    expect(plain).not.toContain("workflow_dispatch");
    expect(plain).not.toContain("--target");
  });
});
