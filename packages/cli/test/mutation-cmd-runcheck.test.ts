// runCheck passes the check pipeline's diagnostics through; @keel/check is replaced by a recorder here.
import { parseTopology } from "@keel/compiler";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { files: unknown; options: unknown }[] = [];
let answer: unknown[] = [];

vi.mock("@keel/check", () => ({
  check: (files: unknown, options: unknown) => {
    calls.push({ files, options });
    return { diagnostics: answer };
  },
}));

const { runCheck } = await import("../src/internal/runCheck.ts");

const TOPOLOGY = "export default { web: { modules: ['todos'], adapter: 'client' } };\n";

beforeEach(() => {
  calls.length = 0;
  answer = [];
});

describe("runCheck", async () => {
  it("passes only path and source of the files, with the root, the project (default the files) and no topology when the project has none", async () => {
    await runCheck("/w", [{ path: "src/a.ts", source: "export const a = 1\n" }]);
    const a = [{ path: "src/a.ts", source: "export const a = 1\n" }];
    expect(calls).toStrictEqual([{ files: a, options: { root: "/w", project: a } }]);
  });

  it("parses the root topology.ts of the project (defaulting to the checked files) for the options", async () => {
    const topology = parseTopology(TOPOLOGY).topology;
    expect(topology).toBeDefined();
    await runCheck("/w", [{ path: "topology.ts", source: TOPOLOGY }]);
    expect(calls[0]?.options).toStrictEqual({
      root: "/w",
      topology,
      project: [{ path: "topology.ts", source: TOPOLOGY }],
    });
    await runCheck("/w", [{ path: "src/a.ts", source: "" }], [{ path: "topology.ts", source: TOPOLOGY }]);
    expect(calls[1]?.options).toEqual({ root: "/w", topology, project: [{ path: "topology.ts", source: TOPOLOGY }] });
    await runCheck("/w", [{ path: "topology.ts", source: TOPOLOGY }], [{ path: "src/a.ts", source: "" }]);
    expect(calls[2]?.options).toEqual({ root: "/w", project: [{ path: "src/a.ts", source: "" }] });
  });

  it("keeps present optional fields (path made project-relative) and omits absent ones", async () => {
    answer = [
      { code: "E0001", message: "bare" },
      { code: "W0002", path: "/w/src/a.ts", line: 3, col: 4, message: "full", fix: "f", see: "s" },
      { code: "E0003", path: "src/b.ts", message: "path only" },
      { code: "E0004", line: 9, message: "line only" },
      { code: "E0005", col: 8, message: "col only" },
      { code: "E0006", message: "fix only", fix: "x" },
      { code: "E0007", message: "see only", see: "y" },
    ];
    expect(await runCheck("/w", [])).toStrictEqual([
      { kind: "diag", code: "E0001", message: "bare" },
      { kind: "diag", code: "W0002", path: "src/a.ts", line: 3, col: 4, message: "full", fix: "f", see: "s" },
      { kind: "diag", code: "E0003", path: "src/b.ts", message: "path only" },
      { kind: "diag", code: "E0004", line: 9, message: "line only" },
      { kind: "diag", code: "E0005", col: 8, message: "col only" },
      { kind: "diag", code: "E0006", message: "fix only", fix: "x" },
      { kind: "diag", code: "E0007", message: "see only", see: "y" },
    ]);
  });
});
