// E1509 (k.prefix): beside a prefixed route, a route whose first segment is a param is a collision whatever the
// param's name, also when it is named after the prefix param but declares no `pathDefault`.
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { manifest } from "../src/manifest.ts";

const view = (): Node => document.createComment("");
const Plain = s.enum(["en-US", "de-DE"]);
const Default = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
const Show = s.object({ locale: Default, id: s.string({ min: 1 }) });

describe("k.prefix E1509 for a first-segment param named after the prefix param", () => {
  it("is E1509 beside a prefixed route when the route's own param has no pathDefault", () => {
    expect(() =>
      manifest({
        "x.show": { path: "/:locale/items/:id", params: Show, component: view },
        "x.legacy": { path: "/:locale/legacy", params: s.object({ locale: Plain }), component: view },
      }),
    ).toThrow(/E1509 x\.legacy/);
  });

  it("is not E1509 without a prefixed route, and the prefixed routes alone are accepted", () => {
    expect(() =>
      manifest({ "x.legacy": { path: "/:locale/legacy", params: s.object({ locale: Plain }), component: view } }),
    ).not.toThrow();
    expect(() => manifest({ "x.show": { path: "/:locale/items/:id", params: Show, component: view } })).not.toThrow();
  });
});
