// E1509 (k.prefix): beside a prefixed route, a route whose first segment is a param is a collision whatever the
// param's name, also when it is named after the prefix param but declares no `pathDefault`.
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
const Plain = s.enum(["en-US", "de-DE"]);
const Default = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
const Show = s.object({ locale: Default, id: s.string({ min: 1 }) });

describe("k.prefix E1509 for a first-segment param named after the prefix param", () => {
  it("is E1509 beside a prefixed route when the route's own param has no pathDefault", () => {
    expect(() =>
      contract("x", {
        "x.show": { path: "/:locale/items/:id", params: Show },
        "x.legacy": { path: "/:locale/legacy", params: s.object({ locale: Plain }) },
      }),
    ).toThrow(/E1509 x\.legacy/);
  });

  it("is not E1509 without a prefixed route, and the prefixed routes alone are accepted", () => {
    expect(() =>
      contract("x", { "x.legacy": { path: "/:locale/legacy", params: s.object({ locale: Plain }) } }),
    ).not.toThrow();
    expect(() => contract("x", { "x.show": { path: "/:locale/items/:id", params: Show } })).not.toThrow();
  });
});
