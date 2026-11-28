// The Capacitor shell files and CI jobs the deploy generator takes from `capacitorTarget` (std.capacitor Files, CI),
// through `deployFiles` of `@keel/scaffold`. Seed 1337.
import { type DeployTopology, deployFiles } from "@keel/scaffold";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { capacitorTarget } from "../src/tools/capacitorTarget.ts";

const shells = { capacitor: capacitorTarget };
const label = fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/);
const shell = fc.record({
  id: fc.tuple(label, label, label).map((p) => p.join(".")),
  name: fc.stringMatching(/^[A-Z][a-z]{1,8}$/),
});

describe("capacitor files", () => {
  test("a client declaring capacitor gets the config; a node deployable none", () => {
    fc.assert(
      fc.property(shell, (cap) => {
        const topology: DeployTopology = {
          web: { modules: ["c"], adapter: "client", shells: { capacitor: cap } },
          api: { modules: ["a"], adapter: "node" },
        };
        const files = deployFiles(topology, { ci: false, shells });
        expect(JSON.parse(files.get("deploy/web/capacitor/capacitor.config.json") ?? "")).toEqual({
          appId: cap.id,
          appName: cap.name,
          webDir: "www",
        });
        expect([...files.keys()].filter((p) => p.includes("/capacitor/"))).toEqual([
          "deploy/web/capacitor/capacitor.config.json",
        ]);
        expect([...files.keys()].filter((p) => p.startsWith("deploy/api/"))).toEqual(["deploy/api/Dockerfile"]);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test("shells on a node or static deployable write nothing", () => {
    const capacitor = { id: "dev.keel.golden", name: "Golden" };
    const files = deployFiles(
      {
        web: { modules: ["c"], adapter: "client", shells: { capacitor } },
        api: { modules: ["a"], adapter: "node", shells: { capacitor } },
        docs: { modules: ["d"], adapter: "static", shells: { capacitor } },
      },
      { ci: false, shells },
    );
    expect([...files.keys()].filter((p) => p.includes("/capacitor/") && !p.startsWith("deploy/web/"))).toEqual([]);
  });

  test("the CI workflow gains an Android job and a manual iOS job", () => {
    const capacitor = { id: "dev.keel.golden", name: "Golden" };
    const ci =
      deployFiles({ web: { modules: ["c"], adapter: "client", shells: { capacitor } } }, { ci: true, shells }).get(
        ".github/workflows/ci.yml",
      ) ?? "";
    expect(ci).toContain("pnpm exec keel build --target capacitor --platform android");
    expect(ci).toContain("pnpm exec keel build --target capacitor --platform ios");
    expect(ci).toContain("path: dist/web/capacitor/android/app/build/outputs/apk/debug/app-debug.apk");
    expect(ci).toContain("github.event_name == 'workflow_dispatch'");
    expect(ci).toContain("  workflow_dispatch: {}");
    expect(ci).toContain("macos-15");
    const plain = deployFiles({ web: { modules: ["c"], adapter: "client" } }, { ci: true, shells }).get(
      ".github/workflows/ci.yml",
    );
    expect(plain).not.toContain("workflow_dispatch");
    expect(plain).not.toContain("--target");
  });
});
