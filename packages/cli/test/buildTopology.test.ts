// cli D31: `keel build` parses topology.ts like `keel check`, so client-only deployables skip E1004.
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { buildCommand } from "../src/internal/buildCommand.ts";

const CWD = "/work/app";
const routes = {
  path: "modules/todos/routes.ts",
  source: `import { loadList } from "./loadList.server.ts";\nexport const r = loadList;\n`,
};
const topology = (adapter: string) => ({
  path: "topology.ts",
  source: `export default { web: { modules: ['todos'], adapter: '${adapter}' } };\n`,
});

describe("build with a topology", () => {
  it("adapter 'client' does not report E1004 and writes the artifacts", async () => {
    const r = await run(["build", "--format=json"], {
      cwd: CWD,
      files: [topology("client"), routes],
    });
    expect(r.stdout).not.toContain("E1004");
    expect(r.code).toBe(0);
  });

  it("a static deployable still reports E1004; so does a project without topology.ts", async () => {
    const node = await run(["build", "--format=json"], {
      cwd: CWD,
      files: [topology("static"), routes],
    });
    expect(node.stdout).toContain("E1004");
    const none = await run(["build", "--format=json"], {
      cwd: CWD,
      files: [routes],
    });
    expect(none.stdout).toContain("E1004");
  });

  it("counts every artifact the build is responsible for, written or unchanged", async () => {
    const node = {
      path: "topology.ts",
      source: "export default topology({ api: { modules: ['todos'], adapter: 'node' } });\n",
    };
    const count = (o: { records: readonly object[] }) => {
      const last = o.records.at(-1);
      return last && "counts" in last && typeof last.counts === "object" && last.counts && "artifacts" in last.counts
        ? last.counts.artifacts
        : undefined;
    };
    const first = await buildCommand({ cwd: CWD, files: [node, routes] });
    const written = first.writes.flatMap((w) => (w.content === null ? [] : [{ path: w.path, source: w.content }]));
    const again = await buildCommand({
      cwd: CWD,
      files: [node, routes, ...written],
    });
    // four .keel artifacts, std.json, compose, the Dockerfile and the CI workflow
    expect(count(first)).toBe(8);
    expect(count(again)).toBe(8);
    expect(first.writes.map((w) => w.path)).toContain(".github/workflows/ci.yml");
  });

  it("writes no CI workflow for an app inside a workspace: its CI lives at the workspace root", async () => {
    const node = {
      path: "topology.ts",
      source: "export default topology({ api: { modules: ['todos'], adapter: 'node' } });\n",
    };
    const read = (p: string) => (p === "/work/pnpm-workspace.yaml" ? "packages: []\n" : undefined);
    const inside = await buildCommand({ cwd: CWD, files: [node, routes], read });
    expect(inside.writes.map((w) => w.path)).not.toContain(".github/workflows/ci.yml");
    expect(inside.writes.map((w) => w.path)).toContain("deploy/api/Dockerfile");
  });
});
