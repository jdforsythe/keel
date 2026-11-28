// `keel build` parses topology.ts like `keel check`: a `client` module's `*.server.ts` file is no server-only file, so
// importing it is no E1004; under a `static` deployable or with no topology.ts it is, and the build stops at the check.
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { buildCommand } from "../src/internal/buildCommand.ts";

const CWD = "/work/app";
const load = { path: "modules/todos/loadList.server.ts", source: "export const loadList = 1;\n" };
const view = {
  path: "modules/todos/view.ts",
  source: `import { loadList } from "./loadList.server.ts";\nexport const view = loadList;\n`,
};
const mod = {
  path: "modules/todos/module.ts",
  source:
    "declare const module: (m: object) => object;\nexport default module({ id: 'todos', deps: [], capabilities: [], public: { exports: [] } });\n",
};
const topology = (adapter: string) => ({
  path: "topology.ts",
  source: `export default { web: { modules: ['todos'], adapter: '${adapter}' } };\n`,
});

describe("build with a topology", () => {
  it("adapter 'client' does not report E1004 and writes the artifacts", async () => {
    const r = await run(["build", "--format=json"], {
      cwd: CWD,
      files: [topology("client"), mod, load, view],
    });
    expect(r.stdout).not.toContain("E1004");
    expect(r.code).toBe(0);
  });

  it("a static deployable still reports E1004; so does a project without topology.ts", async () => {
    const node = await run(["build", "--format=json"], {
      cwd: CWD,
      files: [topology("static"), mod, load, view],
    });
    expect(node.stdout).toContain("E1004");
    const none = await run(["build", "--format=json"], {
      cwd: CWD,
      files: [load, view],
    });
    expect(none.stdout).toContain("E1004");
  });

  it("counts every artifact the build is responsible for, written or unchanged", async () => {
    const node = {
      path: "topology.ts",
      source:
        "declare const topology: (t: object) => object;\nexport default topology({ api: { modules: ['todos'], adapter: 'node' } });\n",
    };
    const count = (o: { records: readonly object[] }) => {
      const last = o.records.at(-1);
      return last && "counts" in last && typeof last.counts === "object" && last.counts && "artifacts" in last.counts
        ? last.counts.artifacts
        : undefined;
    };
    const first = await buildCommand({ cwd: CWD, files: [node, mod, load] });
    const written = first.writes.flatMap((w) => (w.content === null ? [] : [{ path: w.path, source: w.content }]));
    const again = await buildCommand({
      cwd: CWD,
      files: [node, mod, load, ...written],
    });
    // five .keel artifacts, std.json, compose, the Dockerfile and the CI workflow
    expect(count(first)).toBe(9);
    expect(count(again)).toBe(9);
    expect(first.writes.map((w) => w.path)).toContain(".github/workflows/ci.yml");
  });

  it("writes no CI workflow for an app inside a workspace: its CI lives at the workspace root", async () => {
    const node = {
      path: "topology.ts",
      source:
        "declare const topology: (t: object) => object;\nexport default topology({ api: { modules: ['todos'], adapter: 'node' } });\n",
    };
    const read = (p: string) => (p === "/work/pnpm-workspace.yaml" ? "packages: []\n" : undefined);
    const inside = await buildCommand({ cwd: CWD, files: [node, mod, load], read });
    expect(inside.writes.map((w) => w.path)).not.toContain(".github/workflows/ci.yml");
    expect(inside.writes.map((w) => w.path)).toContain("deploy/api/Dockerfile");
  });
});
