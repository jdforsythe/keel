// @vitest-environment happy-dom
// rfc:0160 conformance: `Frame` with a `src` of the document's own origin renders `about:blank`.
// Spec: k.origins, Frame "A `src` not absolute `http` or `https`, relative too, or of the document's origin renders `about:blank`."
// Seed 1337 (fc.assert below). The document's origin is set with happy-dom's `setURL`.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Frame } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
const simCtx = createCtx({ mode: "sim", seed: 1337 });

const SEED = 1337;

function render(src: string): string | null {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(() => Reflect.apply(Frame, undefined, [{ id: "frame", title: "Demo", src }]), host, {
    ctx: simCtx,
  });
  const value = document.getElementById("frame")?.getAttribute("src") ?? null;
  off();
  host.remove();
  return value;
}
const at = (url: string): void => {
  const hd: unknown = Reflect.get(window, "happyDOM");
  if (typeof hd !== "object" || hd === null) throw new Error("not a happy-dom window");
  Reflect.apply(Reflect.get(hd, "setURL"), hd, [url]);
};
afterEach(() => at("about:blank"));

describe("rfc:0160 conformance: Frame of the document's own origin", () => {
  it("rfc:0160 conformance: `Frame src` of the document's own origin renders `about:blank`", () => {
    at("https://app.example/page");
    expect(render("https://app.example/embed")).toBe("about:blank");
    expect(render("https://app.example")).toBe("about:blank");
    expect(render("https://other.example/embed")).toBe("https://other.example/embed");
  });
  it("rfc:0160 conformance: a different scheme or port is another origin and keeps its value", () => {
    at("https://app.example:8443/page");
    expect(render("https://app.example/embed")).toBe("https://app.example/embed");
    expect(render("https://app.example:8443/embed")).toBe("about:blank");
  });
  it("rfc:0160 conformance: for any host and path, a `src` on the document's origin is `about:blank` and on another host is kept", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,10}$/), fc.stringMatching(/^[a-z]{1,8}$/), (h, p) => {
        at(`https://${h}.example/x`);
        expect(render(`https://${h}.example/${p}`)).toBe("about:blank");
        expect(render(`https://${h}2.example/${p}`)).toBe(`https://${h}2.example/${p}`);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
