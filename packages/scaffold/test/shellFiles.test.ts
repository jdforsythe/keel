// The shell files and CI jobs `deployFiles` takes from the shell targets it is given (k.shell Files, CI), against a stub
// target: its files land under `deploy/<name>/<shell>/`, `deployDrift` removes them when the shell leaves the topology and
// keeps the app's own files there, and its jobs are framed in `ci.yml`. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type DeployShells, type DeployTopology, type ShellApp, deployDrift, deployFiles } from "../src/index.ts";

const POLICY = "default-src 'none'; frame-ancestors 'none'";
const label = fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/);
const shell = fc.record({
  id: fc.tuple(label, label, label).map((p) => p.join(".")),
  name: fc.stringMatching(/^[A-Z][a-z]{1,8}$/),
});

/** What the stub target was given, by `files` and `ci` calls. */
const seen: ShellApp[] = [];
/** A stub `tauri` target: two files, one of them in a folder, and an automatic and a manual job. */
const shells: DeployShells = {
  tauri: {
    files: (app) => {
      seen.push(app);
      return { "a.txt": `${app.name}|${app.id}|${app.pkg}|${app.version}`, "sub/b.txt": "B" };
    },
    ci: (app) => [
      {
        job: "auto",
        runsOn: "ubuntu-24.04",
        manual: false,
        steps: ["echo prepare"],
        env: { FOO: "bar" },
        artifact: `dist/${app.deployable}/tauri/out`,
      },
      { job: "hand", runsOn: "macos-15", platform: "p", manual: true, steps: [], env: {} },
    ],
  },
};

describe("shell files from a target", () => {
  test("a client declaring the shell gets the target's files under deploy/<name>/<shell>/, given its app", () => {
    fc.assert(
      fc.property(shell, (tau) => {
        seen.length = 0;
        const topology: DeployTopology = {
          web: { modules: ["c"], adapter: "client", shells: { tauri: tau } },
          api: { modules: ["a"], adapter: "node" },
        };
        const files = deployFiles(topology, {
          ci: false,
          version: "2.3.4",
          pkg: "golden-1",
          policy: () => POLICY,
          shells,
        });
        expect(files.get("deploy/web/tauri/a.txt")).toBe(`${tau.name}|${tau.id}|golden-1|2.3.4`);
        expect(files.get("deploy/web/tauri/sub/b.txt")).toBe("B");
        expect([...files.keys()].filter((p) => p.startsWith("deploy/api/"))).toEqual(["deploy/api/Dockerfile"]);
        expect(seen).toEqual([
          {
            deployable: "web",
            id: tau.id,
            name: tau.name,
            version: "2.3.4",
            pkg: "golden-1",
            policy: POLICY,
            identity: false,
          },
        ]);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test("each app is given the policy for its own deployable's declared origins (k.origins)", () => {
    seen.length = 0;
    const tauri = { id: "dev.keel.golden", name: "Golden" };
    const topology: DeployTopology = {
      a: { modules: ["c"], adapter: "client", shells: { tauri }, origins: { img: { "https://a.example": "photos" } } },
      b: { modules: ["d"], adapter: "client", shells: { tauri } },
    };
    const policy = (origins?: { readonly img?: Readonly<Record<string, string>> }): string =>
      `img-src ${Object.keys(origins?.img ?? {}).join(" ")}`;
    const files = deployFiles(topology, { ci: false, policy, shells });
    expect(files.has("deploy/a/tauri/a.txt")).toBe(true);
    expect(seen.map((a) => [a.deployable, a.policy])).toEqual([
      ["a", "img-src https://a.example"],
      ["b", "img-src "],
    ]);
  });

  test("the app is given the policy, identity and defaults the project gives or lacks", () => {
    seen.length = 0;
    const topology: DeployTopology = {
      web: { modules: ["c"], adapter: "client", shells: { tauri: { id: "dev.keel.golden", name: "Golden" } } },
    };
    deployFiles(topology, { ci: false, identity: true, shells });
    deployFiles(topology, { ci: false, shells });
    expect(seen.map((a) => [a.version, a.pkg, a.policy, a.identity])).toEqual([
      ["0.0.0", "", undefined, true],
      ["0.0.0", "", undefined, false],
    ]);
  });

  test("without shells, or for a shell with no target, no shell files and no shell jobs are generated", () => {
    const topology: DeployTopology = {
      web: {
        modules: ["c"],
        adapter: "client",
        shells: {
          tauri: { id: "dev.keel.golden", name: "Golden" },
          capacitor: { id: "dev.keel.golden", name: "Golden" },
        },
      },
    };
    for (const s of [undefined, {}, shells]) {
      const files = deployFiles(topology, { ci: true, ...(s === undefined ? {} : { shells: s }) });
      expect([...files.keys()].filter((p) => p.includes("/capacitor/"))).toEqual([]);
      expect(files.get(".github/workflows/ci.yml")).not.toContain("web-capacitor");
      if (s !== shells) {
        expect([...files.keys()].filter((p) => p.includes("/tauri/"))).toEqual([]);
        expect(files.get(".github/workflows/ci.yml")).not.toContain("--target");
      }
    }
  });

  test("shells on a node or static deployable write nothing", () => {
    const tauri = { id: "dev.keel.golden", name: "Golden" };
    const files = deployFiles(
      {
        web: { modules: ["c"], adapter: "client", shells: { tauri } },
        api: { modules: ["a"], adapter: "node", shells: { tauri } },
        docs: { modules: ["d"], adapter: "static", shells: { tauri } },
      },
      { ci: false, shells },
    );
    expect([...files.keys()].filter((p) => p.includes("/tauri/") && !p.startsWith("deploy/web/"))).toEqual([]);
  });

  test("dropping the shell from the topology removes the target's files and keeps the app's own", () => {
    const top = (shells: string) =>
      `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['c'], adapter: 'client'${shells} } })\n`;
    const declared = top(", shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }");
    const tree = (topologyText: string) =>
      new Map([
        ["topology.ts", topologyText],
        ["package.json", '{ "name": "fx", "version": "1.0.0" }'],
        ["deploy/web/tauri/a.txt", "old"],
        ["deploy/web/tauri/sub/b.txt", "B"],
        ["deploy/web/tauri/own.txt", "mine"],
        ["deploy/web/tauri/icons/icon.png", "png"],
      ]);
    const kept = deployDrift(tree(declared), true, undefined, shells);
    expect(kept.map((d) => d.path)).toEqual(["deploy/web/tauri/a.txt"]);
    const dropped = deployDrift(tree(top("")), true, undefined, shells);
    expect(dropped.map((d) => [d.path, d.want])).toEqual([
      ["deploy/web/tauri/a.txt", null],
      ["deploy/web/tauri/sub/b.txt", null],
    ]);
    // A shell with no target is neither written nor removed.
    expect(deployDrift(tree(top("")), true, undefined, {})).toEqual([]);
  });
});

describe("shell jobs from a target", () => {
  const topology: DeployTopology = {
    web: { modules: ["c"], adapter: "client", shells: { tauri: { id: "dev.keel.golden", name: "Golden" } } },
  };

  test("each job is framed as <deployable>-<job> with its runner, steps, build command, env and artifact", () => {
    const ci = deployFiles(topology, { ci: true, shells }).get(".github/workflows/ci.yml") ?? "";
    expect(ci).toContain("  web-auto:");
    expect(ci).toContain("    runs-on: ubuntu-24.04");
    expect(ci).toContain("      - run: echo prepare");
    expect(ci).toContain("      - run: pnpm exec keel build --target tauri\n        env:\n          FOO: bar");
    expect(ci).toContain("          name: web-auto");
    expect(ci).toContain("          path: dist/web/tauri/out");
    expect(ci).toContain("  web-hand:");
    expect(ci).toContain("      - run: pnpm exec keel build --target tauri --platform p");
    expect(ci).toContain("KEEL_ORIGIN: ${{ vars.KEEL_ORIGIN }}");
  });

  test("a manual job adds the workflow_dispatch trigger and runs on it only; an automatic one does not", () => {
    const ci = deployFiles(topology, { ci: true, shells }).get(".github/workflows/ci.yml") ?? "";
    expect(ci).toContain("  workflow_dispatch: {}");
    const lines = ci.split("\n");
    const ifOf = (id: string): string => lines[lines.indexOf(`  ${id}:`) + 2] ?? "";
    expect(ifOf("web-hand")).toContain("&& github.event_name == 'workflow_dispatch'");
    expect(ifOf("web-auto")).not.toContain("workflow_dispatch");
    const auto: DeployShells = { tauri: { files: () => ({}), ci: (a) => shells.tauri?.ci(a).slice(0, 1) ?? [] } };
    const plain = deployFiles(topology, { ci: true, shells: auto }).get(".github/workflows/ci.yml") ?? "";
    expect(plain).not.toContain("workflow_dispatch");
    expect(plain).toContain("web-auto:");
  });
});
