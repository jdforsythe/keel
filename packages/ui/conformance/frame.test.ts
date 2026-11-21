// @vitest-environment happy-dom
// Spec: k.origins, Frame "`Frame` from `@keel/ui` renders `<iframe>` with `src`, a required `title` (E1802, blank too), `allow` from `autoplay`, `encrypted-media`, `fullscreen`, `picture-in-picture` (joined `; `), `loading="lazy"`, `referrerpolicy="strict-origin"` and `sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"`; it takes `id`, `lang` and the style props (k.ui). A `src` not absolute `http` or `https`, relative too, or of the document's origin renders `about:blank`."
// Spec: k.origins, Conformance "`Frame src="https://v.example/e/1" title="Demo"` renders the attributes above; without `title`, or with `title=" "`, E1802; `src="javascript:x"` renders `about:blank`; `src="/e/1"` is E1570."
// Seed 1337 (fc.assert below). The E1802 and E1570 cases through `keel check`: packages/check/conformance/origins-e1570-directives.test.ts.
import { mount } from "@keel/runtime-dom";
import { Box, Frame } from "@keel/ui";
import type { StyleProps } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";

type FrameProps = Parameters<typeof Frame>[0];
type Allow = "autoplay" | "encrypted-media" | "fullscreen" | "picture-in-picture";
const SEED = 1337;

function render(props: Record<string, unknown>): Element | null {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(() => Reflect.apply(Frame, undefined, [{ id: "frame", title: "Demo", ...props }]), host);
  const el = document.getElementById("frame");
  const clone = el === null ? null : el.cloneNode(true);
  off();
  host.remove();
  return clone instanceof Element ? clone : null;
}

describe("k.origins: Frame", () => {
  it('`Frame src="https://v.example/e/1" title="Demo"` renders an `<iframe>` with the attributes above', () => {
    const el = render({ src: "https://v.example/e/1" });
    expect(el?.tagName.toLowerCase()).toBe("iframe");
    expect(el?.getAttribute("src")).toBe("https://v.example/e/1");
    expect(el?.getAttribute("title")).toBe("Demo");
    expect(el?.getAttribute("loading")).toBe("lazy");
    expect(el?.getAttribute("referrerpolicy")).toBe("strict-origin");
    expect(el?.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-popups allow-presentation");
  });

  it("`title` is required, as a type", () => {
    expectTypeOf<{ src: string; title: string }>().toMatchTypeOf<FrameProps>();
    expectTypeOf<{ src: string }>().not.toMatchTypeOf<FrameProps>();
    expect(true).toBe(true);
  });

  it("`allow` takes only `autoplay`, `encrypted-media`, `fullscreen` and `picture-in-picture`, as a type", () => {
    expectTypeOf<{ src: string; title: string; allow: readonly Allow[] }>().toMatchTypeOf<FrameProps>();
    expectTypeOf<{ src: string; title: string; allow: readonly ["camera"] }>().not.toMatchTypeOf<FrameProps>();
    expect(true).toBe(true);
  });

  it("`allow` is written joined by `; ` in the order given", () => {
    const sets: readonly Allow[][] = [
      ["encrypted-media", "fullscreen", "picture-in-picture"],
      ["autoplay"],
      ["fullscreen", "autoplay"],
    ];
    for (const allow of sets) {
      expect(render({ src: "https://v.example/e/1", allow })?.getAttribute("allow")).toBe(allow.join("; "));
    }
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom<Allow>("autoplay", "encrypted-media", "fullscreen", "picture-in-picture"), {
          minLength: 1,
          maxLength: 4,
        }),
        (allow) => {
          expect(render({ src: "https://v.example/e/1", allow })?.getAttribute("allow")).toBe(allow.join("; "));
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("`loading`, `referrerpolicy` and `sandbox` are fixed whatever else is given", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,10}$/), fc.stringMatching(/^[A-Za-z]{1,10}$/), (path, title) => {
        const el = render({ src: `https://v.example/${path}`, title });
        expect(el?.getAttribute("loading")).toBe("lazy");
        expect(el?.getAttribute("referrerpolicy")).toBe("strict-origin");
        expect(el?.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-popups allow-presentation");
        expect(el?.getAttribute("title")).toBe(title);
        expect(el?.getAttribute("src")).toBe(`https://v.example/${path}`);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("it takes `id` and `lang`", () => {
    const el = render({ src: "https://v.example/e/1", id: "frame", lang: "fr" });
    expect(el?.getAttribute("id")).toBe("frame");
    expect(el?.getAttribute("lang")).toBe("fr");
  });

  it("it takes the style props (k.ui): `StyleProps` is accepted, and the class list is the one a `Box` gets for the same props", () => {
    expectTypeOf<{ src: string; title: string } & StyleProps>().toMatchTypeOf<FrameProps>();
    const style = { p: "2", bg: "accent" } satisfies StyleProps;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const off = mount(() => Box({ id: "box", ...style }), host);
    const boxClass = document.getElementById("box")?.getAttribute("class") ?? "";
    off();
    host.remove();
    expect(boxClass).not.toBe("");
    expect(render({ src: "https://v.example/e/1", ...style })?.getAttribute("class")).toBe(boxClass);
  });

  it('`src="javascript:x"` renders `about:blank`', () => {
    expect(render({ src: "javascript:x" })?.getAttribute("src")).toBe("about:blank");
  });

  it('a relative `src`, `src="/e/1"`, renders `about:blank`', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,8}(\/[a-z]{1,8}){0,2}$/), (p) => {
        expect(render({ src: `/${p}` })?.getAttribute("src")).toBe("about:blank");
        expect(render({ src: p })?.getAttribute("src")).toBe("about:blank");
        expect(render({ src: `//${p}.example/x` })?.getAttribute("src")).toBe("about:blank");
      }),
      { seed: SEED, numRuns: 30 },
    );
    expect(render({ src: "/e/1" })?.getAttribute("src")).toBe("about:blank");
  });

  it("a `src` not absolute `http` or `https` renders `about:blank`, and one that is keeps its value", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{2,8}$/).filter((s) => s !== "http" && s !== "https"),
        fc.stringMatching(/^[a-z0-9]{0,8}$/),
        (scheme, rest) => {
          expect(render({ src: `${scheme}:${rest}` })?.getAttribute("src")).toBe("about:blank");
          expect(render({ src: `${scheme.toUpperCase()}:${rest}` })?.getAttribute("src")).toBe("about:blank");
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
    for (const sch of ["http", "https"]) {
      expect(render({ src: `${sch}://v.example/e/1` })?.getAttribute("src")).toBe(`${sch}://v.example/e/1`);
    }
  });
});
