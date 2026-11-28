// @vitest-environment happy-dom
// k.origins Frame: a `src` of the document's own origin renders `about:blank`, since a frame of the app's own origin
// with `allow-scripts allow-same-origin` is not sandboxed; another origin's `src` renders as given. Seed 1337.
import { Frame } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const srcOf = (src: string): string | null => {
  const el = Frame({ src, title: "t" });
  return el instanceof Element ? el.getAttribute("src") : null;
};

describe("Frame src and the document's own origin", () => {
  it("renders about:blank for any path, query or case of the document's own origin", () => {
    const own = location.origin;
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9/?=&]{0,20}$/), fc.boolean(), (rest, upper) => {
        const base = upper ? own.toUpperCase() : own;
        expect(srcOf(`${base}/${rest}`)).toBe("about:blank");
        expect(srcOf(`https://player.video.example/${rest}`)).toBe(`https://player.video.example/${rest}`);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
  it("renders about:blank for an absolute URL that does not parse", () => {
    expect(srcOf("https://")).toBe("about:blank");
  });
});
