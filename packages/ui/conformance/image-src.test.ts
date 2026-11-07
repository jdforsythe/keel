// @vitest-environment happy-dom
// Spec: k.ui, clause "`Image src` accepts a string such as `'logo.png'` (no `Href` required); a `javascript:` value renders as `about:blank`." Seed 1337.
import { mount } from "@keel/runtime-dom";
import { Image } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";

type ImageProps = Parameters<typeof Image>[0];
const SEED = 1337;

const srcOf = (src: string): string | null => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(() => Image({ id: "img", alt: "logo", src }), host);
  const value = document.getElementById("img")?.getAttribute("src") ?? null;
  off();
  host.remove();
  return value;
};

describe("k.ui Image src", () => {
  it("Image src accepts a string such as 'logo.png' (no Href required)", () => {
    expectTypeOf<{ alt: "logo"; src: "logo.png" }>().toMatchTypeOf<ImageProps>();
    expectTypeOf<{ alt: string; src: string }>().toMatchTypeOf<ImageProps>();
    expect(srcOf("logo.png")).toBe("logo.png");
  });
  it("an asset path src is kept as written", () => {
    // seed 1337
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,8}\/[a-z]{1,8}\.(png|svg|jpg)$/), (p) => {
        expect(srcOf(p)).toBe(p);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
  it("a javascript: src value renders as about:blank", () => {
    expect(srcOf("javascript:alert(1)")).toBe("about:blank");
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9(); ]{0,12}$/),
        fc.constantFrom("javascript:", "JavaScript:", "JAVASCRIPT:"),
        (rest, scheme) => {
          expect(srcOf(`${scheme}${rest}`)).toBe("about:blank");
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});
