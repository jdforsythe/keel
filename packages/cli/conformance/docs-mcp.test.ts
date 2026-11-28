// Spec: k.docs, clause "The MCP tools include `docs`, not `spec`; `docs` on `{ id: 'k.cli' }` yields the records of `keel docs k.cli --format=json`, and on `{ id: 'a' }` those of `keel docs a --format=json`."
// The tool takes `format` like every command (k.cli: every command accepts --format); the default is compact, so the call passes json to compare records.
// Seed: none. Red: the tool `docs` is absent and `spec` is still listed.
import { mcp, run } from "@keel/cli";
import { describe, expect, it } from "vitest";
import { type Files, CLI_VERSION, baseline, cliPkg, parseJsonLines, pkg, project } from "./docs-support";

const CWD = "/work/app";
const call = (id: number, method: string, params: unknown): string =>
  `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
const field = (v: unknown, name: string): unknown =>
  typeof v === "object" && v !== null && name in v ? Reflect.get(v, name) : undefined;
const reply = (out: string): unknown => {
  const first = out.split("\n").find((l) => l !== "");
  return first === undefined ? undefined : field(JSON.parse(first), "result");
};
const files: Files = baseline(
  pkg("cli", "7.1.0", [{ id: "k.cli", title: "CLI", text: "# k.cli: CLI\nE1051 unknown command\n" }]),
);

describe("k.docs MCP tool", () => {
  it("the MCP tools include docs and not spec", async () => {
    const out = await mcp(() => ({ cwd: CWD, files })).receive(call(1, "tools/list", {}));
    const tools = field(reply(out), "tools");
    const names = Array.isArray(tools) ? tools.map((t) => field(t, "name")) : [];
    expect(names).toContain("docs");
    expect(names).not.toContain("spec");
  });

  it("`docs` on { id: 'k.cli' } yields the records of `keel docs k.cli --format=json`", async () => {
    const cli = await run(["docs", "k.cli", "--format=json"], { cwd: CWD, files });
    const out = await mcp(() => ({ cwd: CWD, files })).receive(
      call(1, "tools/call", { name: "docs", arguments: { id: "k.cli", format: "json" } }),
    );
    const content = field(reply(out), "content");
    const text = Array.isArray(content) ? String(field(content[0], "text")) : "";
    expect(parseJsonLines(text).length).toBeGreaterThan(0);
    expect(parseJsonLines(text)).toEqual(parseJsonLines(cli.stdout));
  });

  it("`docs` on { id: 'a' } yields the records of `keel docs a --format=json`", async () => {
    const x = { id: "k.x", title: "Xs", codes: [], text: "# k.x: Xs\nstatus: implemented\n" };
    const areaFiles: Files = [
      ...project(["cli", "router"]),
      ...cliPkg([{ id: "k.x", title: "Xs", package: "@keel/router", holds: "the x", area: "a" }], []),
      ...pkg("router", CLI_VERSION, [x]),
    ];
    const cli = await run(["docs", "a", "--format=json"], { cwd: CWD, files: areaFiles });
    expect(cli.code).toBe(0);
    const out = await mcp(() => ({ cwd: CWD, files: areaFiles })).receive(
      call(1, "tools/call", { name: "docs", arguments: { id: "a", format: "json" } }),
    );
    const content = field(reply(out), "content");
    const text = Array.isArray(content) ? String(field(content[0], "text")) : "";
    const recs = parseJsonLines(text);
    expect(recs[0]).toMatchObject({ kind: "docs.area", id: "a", sections: 1 });
    expect(recs).toEqual(parseJsonLines(cli.stdout));
  });
});
