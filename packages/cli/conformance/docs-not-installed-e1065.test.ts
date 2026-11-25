// Spec: k.docs, clause "With `@keel/std-tables` installed nowhere, `keel docs std.tables` emits E1065 naming `@keel/std-tables`, exit 1, and `keel docs` lists `std.tables` with `installed: false`."
// Seed: none. Compact ` not installed` suffix from k.docs "Forms" (`docs.entry` compact). Red: `docs` is absent (E1051).
import { describe, expect, it } from "vitest";
import { baseline, jsonRecords, lines, run } from "./docs-support";

describe("k.docs E1065", () => {
  it("`keel docs std.tables` with @keel/std-tables installed nowhere emits E1065 naming @keel/std-tables, exit 1", async () => {
    const r = await run(["docs", "std.tables"], { files: baseline() });
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toContain("E1065");
    expect(r.stdout + r.stderr).toContain("@keel/std-tables");
  });

  it("`keel docs` lists std.tables with installed: false", async () => {
    const r = await jsonRecords(["docs"], baseline());
    expect(r.code).toBe(0);
    const e = r.recs.find((x) => x.kind === "docs.entry" && x.id === "std.tables");
    expect(e).toMatchObject({ package: "@keel/std-tables", installed: false });
    expect(r.recs.find((x) => x.kind === "docs.entry" && x.id === "k.router")).toMatchObject({ installed: true });
  });

  it("compact `keel docs` ends the std.tables line with ` not installed` and no other line has it", async () => {
    const r = await run(["docs", "--format=compact"], { files: baseline() });
    const ls = lines(r.stdout);
    const t = ls.find((l) => l.startsWith("std.tables "));
    expect(t).toBe("std.tables Tables @keel/std-tables not installed");
    expect(ls.filter((l) => l.endsWith(" not installed"))).toHaveLength(1);
    expect(ls).toContain("k.router Routes @keel/router");
  });
});
