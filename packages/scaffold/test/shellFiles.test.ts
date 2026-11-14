// The shell files and storage-specific deploy files `deployFiles` derives from a topology (k.shell Files, k.deploy).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { deployFiles } from "../src/deployFiles.ts";
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
