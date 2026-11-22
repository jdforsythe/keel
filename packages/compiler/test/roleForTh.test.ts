// roleFor (k.a11y, HTML-AAM): a `th` with `scope` `row` or `rowgroup` is `rowheader`, any other `th` `columnheader`;
// a `scope` not known statically gives no role. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { roleFor } from "../src/a11y/roleFor.ts";

const th = (scope: string | null | undefined) =>
  roleFor("th", (name) => (name === "scope" ? scope : name === "role" ? null : null));

describe("roleFor th", () => {
  it("scope row and rowgroup, any case, are rowheader; col, colgroup and none are columnheader", () => {
    expect(th("row")).toBe("rowheader");
    expect(th(" RowGroup ")).toBe("rowheader");
    expect(th("col")).toBe("columnheader");
    expect(th("colgroup")).toBe("columnheader");
    expect(th(null)).toBe("columnheader");
    expect(th(undefined)).toBeUndefined();
  });

  it("property: a scope other than row or rowgroup is columnheader", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !["row", "rowgroup"].includes(s.trim().toLowerCase())),
        (s) => th(s) === "columnheader",
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});
