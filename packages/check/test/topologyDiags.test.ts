// E1552 and E1566 in keel check (k.topology, k.hosting Host): a part of topology.ts the static read cannot take, at
// its deployable, and a bad `host`, on its `host`.
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import { explain } from "../src/explain.ts";
import { topologyDiags } from "../src/internal/topologyDiags.ts";

const SOURCE = [
  'import { topology } from "@keel/server";',
  "export default topology({",
  '  api: { modules: ["a"], adapter: "node" },',
  '  web: { modules: ["w"], adapter: "client", host: "nowhere" },',
  "});",
  "",
].join("\n");

describe("topologyDiags", () => {
  it("reports E1566 on the deployable's host", () => {
    const [d, ...rest] = topologyDiags(
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
      topologyDiags("", {
        api: { modules: ["a"], adapter: "node" },
        web: { modules: ["w"], adapter: "client", host: "api" },
      }),
    ).toEqual([]);
  });

  it("reports E1566 for a host that is not a string literal", () => {
    const source = SOURCE.replace('host: "nowhere"', "host: `api`");
    const [d, ...rest] = topologyDiags(
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

  it("reports E1552 at the deployable whose adapter or modules is not a literal, or whose name is out of form", () => {
    const need = "needs modules: [...] and adapter: 'node' | 'static' | 'client'";
    for (const [from, to, message] of [
      ['adapter: "client"', "adapter: CLIENT", `web: ${need}`],
      ['modules: ["w"]', "modules: W", `web: ${need}`],
      ["  web:", "  Web:", "Web: name must be lowercase letters, digits and -, starting with a letter"],
      ["  web:", '  "../x":', "../x: name must be lowercase letters, digits and -, starting with a letter"],
    ] as const) {
      const source = SOURCE.replace('host: "nowhere"', 'host: "api"').replace(from, to);
      const files = [{ path: "topology.ts", source }];
      const ds = check(files, { types: false, topology: {} }).diagnostics.filter((d) => d.code === "E1552");
      expect(
        ds.map((d) => [d.path, d.line, d.see, d.message]),
        to,
      ).toEqual([["topology.ts", 4, "k.topology", message]]);
    }
  });

  it("reports a whole-file E1552 at the top of topology.ts", () => {
    const ds = topologyDiags("apps/a/", {}, "export const x = 1;\n");
    expect(ds.map((d) => [d.code, d.path, d.line, d.col, d.message])).toEqual([
      ["E1552", "apps/a/topology.ts", 1, 1, "no default export"],
    ]);
  });

  it("E1565, E1566 and W1567 have explain rows naming the code", () => {
    for (const code of ["E1552", "E1565", "E1566", "W1567"]) expect(explain(code)).toContain(code);
  });
});
