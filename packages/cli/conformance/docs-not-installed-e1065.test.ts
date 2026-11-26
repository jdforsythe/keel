// Spec: k.docs, clause "With `@keel/std-tables` installed nowhere, `keel docs std.tables` emits E1065 naming `@keel/std-tables`, exit 1, and `keel docs <area>` for the area `map.json` gives `std.tables` lists it with `installed: false`."
// Seed: none. Compact ` not installed` after the package, before `: <holds>`, from k.docs "Forms" (`docs.entry` compact). Red: `docs` is absent (E1051).
// The baseline puts `std.tables` in area `ui` and `k.router` in area `routes` (docs-support).
import { describe, expect, it } from "vitest";
import { baseline, jsonRecords, lines, run } from "./docs-support";

describe("k.docs E1065", () => {
  it("`keel docs std.tables` with @keel/std-tables installed nowhere emits E1065 naming @keel/std-tables, exit 1", async () => {
    const r = await run(["docs", "std.tables"], { files: baseline() });
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toContain("E1065");
    expect(r.stdout + r.stderr).toContain("@keel/std-tables");
  });

  it("`keel docs <area>` for the area map.json gives std.tables lists it with installed: false", async () => {
    const r = await jsonRecords(["docs", "ui"], baseline());
    expect(r.code).toBe(0);
    const e = r.recs.find((x) => x.kind === "docs.entry" && x.id === "std.tables");
    expect(e).toMatchObject({ package: "@keel/std-tables", installed: false });
    const installed = await jsonRecords(["docs", "routes"], baseline());
    expect(installed.recs.find((x) => x.kind === "docs.entry" && x.id === "k.router")).toMatchObject({
      installed: true,
    });
  });

  it("compact `keel docs <area>` puts ` not installed` after the package on the std.tables line and on no installed section's line", async () => {
    const ui = lines((await run(["docs", "ui", "--format=compact"], { files: baseline() })).stdout);
    expect(ui).toContain("std.tables Tables @keel/std-tables not installed: holds of std.tables");
    expect(ui.filter((l) => l.includes(" not installed"))).toHaveLength(1);
    const routes = lines((await run(["docs", "routes", "--format=compact"], { files: baseline() })).stdout);
    expect(routes).toContain("k.router Routes @keel/router: holds of k.router");
    expect(routes.filter((l) => l.includes(" not installed"))).toEqual([]);
  });
});
