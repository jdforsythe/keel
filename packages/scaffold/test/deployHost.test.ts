// A hosted client in the deploy files (k.hosting Host): no deploy file for the client, and the host's CI job runs on
// the hosted client's modules too, since its image carries the client build; `topology.ts`'s `servedBy` is read.
import { describe, expect, it } from "vitest";
import { deployDrift, deployFiles } from "../src/index.ts";

const pathsOf = (ci: string, job: string): string => ci.split("\n").find((l) => l.includes(`echo "${job}=true"`)) ?? "";

describe("deploy files of a hosted client", () => {
  it("writes no Dockerfile for the client; the host's job paths include its modules", () => {
    const files = deployFiles(
      { api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client", servedBy: "api" } },
      { ci: true },
    );
    expect([...files.keys()]).toEqual([".github/workflows/ci.yml", "deploy/compose.yaml", "deploy/api/Dockerfile"]);
    const ci = files.get(".github/workflows/ci.yml") ?? "";
    expect(pathsOf(ci, "api")).toContain("modules/a/|modules/w/");
    expect(pathsOf(ci, "web")).not.toContain("modules/a/");
    expect(ci).toContain("path: dist/web");
  });

  it("deployDrift reads servedBy from topology.ts", () => {
    const top = [
      'import { topology } from "@keel/server";',
      "export default topology({",
      '  api: { modules: ["a"], adapter: "node" },',
      '  web: { modules: ["w"], adapter: "client", servedBy: "api" },',
      "});",
      "",
    ].join("\n");
    const drift = deployDrift(
      new Map([
        ["topology.ts", top],
        [".github/workflows/ci.yml", ""],
      ]),
      true,
    );
    const ci = drift.find((d) => d.path === ".github/workflows/ci.yml")?.want ?? "";
    expect(pathsOf(ci, "api")).toContain("modules/w/");
  });
});
