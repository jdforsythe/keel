// Spec: k.docs, clause "A package present only under `@keel/cli`'s own `node_modules` resolves: `keel docs <its id>` prints its section."
// Seed: none (example). Red: the `docs` operation is absent (E1051).
import { describe, expect, it } from "vitest";
import { jsonRecords, pkg, project, cliPkg, CLIENT_SKILL, ROUTER } from "./docs-support";

describe("k.docs nested package", () => {
  it("a package present only under @keel/cli's own node_modules resolves for `keel docs <its id>`", async () => {
    const files = [
      ...project(["cli"]),
      ...cliPkg([{ id: "k.router", title: "Routes", package: "@keel/router" }], [CLIENT_SKILL]),
      ...pkg("router", "2.3.4", [ROUTER], { base: "node_modules/@keel/cli/node_modules/@keel/router" }),
    ];
    const r = await jsonRecords(["docs", "k.router"], files);
    expect(r.code).toBe(0);
    expect(r.recs.find((x) => x.kind === "docs.section")).toMatchObject({
      id: "k.router",
      package: "@keel/router",
      version: "2.3.4",
    });
  });
});
