// Spec: k.docs "An installed package lacking the file for its `map.json` section emits E1066 naming the package and version, exit 1."
// Spec: k.docs Rules E1066 "... or no readable `docs/index.json`, or `@keel/cli` has no `docs/map.json`; the message names the package and its version."
// Seed: none. Red: `docs` is absent (E1051).
import { describe, expect, it } from "vitest";
import { CLI_VERSION, ROUTER, cliPkg, jsonRecords, pkg, project, run } from "./docs-support";

describe("k.docs E1066", () => {
  it("an installed package lacking docs/<id>.md for its map.json section emits E1066 naming the package and version, exit 1", async () => {
    const files = [
      ...project(["cli", "router"]),
      ...cliPkg([{ id: "k.router", title: "Routes", package: "@keel/router" }], []),
      ...pkg("router", "2.3.4", [ROUTER], { omitFiles: ["k.router"] }),
    ];
    const r = await run(["docs", "k.router"], { files });
    expect(r.code).toBe(1);
    const out = r.stdout + r.stderr;
    expect(out).toContain("E1066");
    expect(out).toContain("@keel/router");
    expect(out).toContain("2.3.4");
  });

  it("an installed package with no readable docs/index.json emits E1066 naming the package and version, exit 1", async () => {
    const files = [
      ...project(["cli", "router"]),
      ...cliPkg([{ id: "k.router", title: "Routes", package: "@keel/router" }], []),
      ...pkg("router", "2.3.4", [ROUTER], { omitIndex: true }),
    ];
    const r = await jsonRecords(["docs", "k.router"], files);
    expect(r.code).toBe(1);
    expect(r.out).toContain("E1066");
    expect(r.out).toContain("@keel/router");
    expect(r.out).toContain("2.3.4");
  });

  it("a @keel/cli with no docs/map.json emits E1066 naming @keel/cli, exit 1", async () => {
    const files = [...project(["cli"]), ...cliPkg([], [], { omitMap: true })];
    const r = await run(["docs"], { files });
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toContain("E1066");
    expect(r.stdout + r.stderr).toContain("@keel/cli");
    expect(CLI_VERSION.length).toBeGreaterThan(0);
  });
});
