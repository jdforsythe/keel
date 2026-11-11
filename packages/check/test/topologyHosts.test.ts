// E1566 in keel check (k.hosting Host): a bad `host` in topology.ts, reported at topology.ts on its `host`.
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import { explain } from "../src/explain.ts";
import { topologyHosts } from "../src/internal/topologyHosts.ts";

const SOURCE = [
  'import { topology } from "@keel/server";',
  "export default topology({",
  '  api: { modules: ["a"], adapter: "node" },',
  '  web: { modules: ["w"], adapter: "client", host: "nowhere" },',
  "});",
  "",
].join("\n");

describe("topologyHosts", () => {
  it("reports E1566 on the deployable's host", () => {
    const [d, ...rest] = topologyHosts(
      "",
      {
        api: { modules: ["a"], adapter: "node" },
        web: { modules: ["w"], adapter: "client", host: "nowhere" },
      },
      SOURCE,
    );
    expect(rest).toEqual([]);
    expect([d?.code, d?.path, d?.line, d?.col, d?.see, d?.message]).toEqual([
      "E1566",
      "topology.ts",
      4,
      45,
      "k.hosting",
      "web: host nowhere is not a node deployable",
    ]);
  });

  it("is empty for a client hosted by a node deployable", () => {
    expect(
      topologyHosts("", {
        api: { modules: ["a"], adapter: "node" },
        web: { modules: ["w"], adapter: "client", host: "api" },
      }),
    ).toEqual([]);
  });

  it("reports E1566 for a host that is not a string literal", () => {
    const source = SOURCE.replace('host: "nowhere"', "host: `api`");
    const [d, ...rest] = topologyHosts(
      "",
      { api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client" } },
      source,
    );
    expect(rest).toEqual([]);
    expect([d?.code, d?.line, d?.message]).toEqual(["E1566", 4, "web: host must be a string literal"]);
  });

  it("runs as a project pass of check()", () => {
    const files = [
      { path: "topology.ts", source: SOURCE },
      { path: "modules/w/x.ts", source: "export const x = 1;\n" },
    ];
    const r = check(files, {
      types: false,
      topology: { api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client", host: "web" } },
    });
    expect(r.diagnostics.filter((d) => d.code === "E1566").map((d) => d.message)).toEqual([
      "web: host web is not a node deployable",
    ]);
  });

  it("E1565, E1566 and W1567 have explain rows naming the code", () => {
    for (const code of ["E1565", "E1566", "W1567"]) expect(explain(code)).toContain(code);
  });
});
