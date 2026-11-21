// Spec: k.origins, Rules "Directives: `img` for `Image src`, `src` and `srcset` of `img`, `srcset` of `source`, `poster`; `media` for `src` of `video`, `audio`, `source`, `track`; `frame` for `Frame src` and `iframe src`; `connect` for E1571. A `srcset` is one E1570 if any absolute candidate is undeclared. `data`, `action` and `formaction` stay E1570. E1570 also reports a literal `Frame src` that is not absolute"
// Spec: k.origins, Conformance "`Frame src="https://v.example/e/1" title="Demo"` renders the attributes above; without `title`, or with `title=" "`, E1802; `src="javascript:x"` renders `about:blank`; `src="/e/1"` is E1570." (the E1570 and E1802 parts)
// Seed 1337 (fc.assert below). Each case: the attribute is E1570 with no declaration, none under its directive, E1570 under any other.
// Lowercase intrinsics also report E1805; only E1570 is read here. ASSUMPTION: `poster` on `video` is the `poster` attribute the spec lists.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, decl, single, withCode } from "./origins-support.ts";

const ORIGIN = "https://a.example";
const URL_ = `${ORIGIN}/x`;
const DIRECTIVES = ["img", "media", "font", "connect", "frame"] as const;
const UI = "import { Frame, Image } from '@keel/ui'\n";
const wrap = (jsx: string): string => `${UI}export default function C() { return ${jsx} }\n`;

const CASES: { name: string; directive: (typeof DIRECTIVES)[number]; jsx: string }[] = [
  { name: "`Image src`", directive: "img", jsx: `<Image src="${URL_}" alt="x" />` },
  { name: "`src` of `img`", directive: "img", jsx: `<img src="${URL_}" alt="x" />` },
  { name: "`srcset` of `img`", directive: "img", jsx: `<img srcset="${URL_} 1x" alt="x" />` },
  { name: "`srcset` of `source`", directive: "img", jsx: `<picture><source srcset="${URL_} 1x" /></picture>` },
  { name: "`poster`", directive: "img", jsx: `<video poster="${URL_}" />` },
  { name: "`src` of `video`", directive: "media", jsx: `<video src="${URL_}" />` },
  { name: "`src` of `audio`", directive: "media", jsx: `<audio src="${URL_}" />` },
  { name: "`src` of `source`", directive: "media", jsx: `<video><source src="${URL_}" /></video>` },
  { name: "`src` of `track`", directive: "media", jsx: `<video><track src="${URL_}" /></video>` },
  { name: "`Frame src`", directive: "frame", jsx: `<Frame src="${URL_}" title="t" />` },
  { name: "`src` of `iframe`", directive: "frame", jsx: `<iframe src="${URL_}" title="t" />` },
];
const e1570 = (origins: string | undefined, source: string) =>
  withCode(single(origins, [{ path: "modules/a/C.tsx", source }]), "E1570");

describe("k.origins: the directive of each E1570 attribute", () => {
  for (const c of CASES) {
    test(`${c.name} is E1570 undeclared, none under \`${c.directive}\`, E1570 under every other directive`, () => {
      expect(e1570(undefined, wrap(c.jsx))).toHaveLength(1);
      expect(e1570(decl(c.directive, ORIGIN), wrap(c.jsx))).toEqual([]);
      for (const other of DIRECTIVES.filter((d) => d !== c.directive)) {
        expect(e1570(decl(other, ORIGIN), wrap(c.jsx))).toHaveLength(1);
      }
    });
  }

  test("`data`, `action` and `formaction` stay E1570 when every directive declares the origin", () => {
    const all = `{ ${DIRECTIVES.map((k) => `${k}: { '${ORIGIN}': 'r' }`).join(", ")} }`;
    for (const jsx of [`<object data="${URL_}" />`, `<form action="${URL_}" />`, `<button formaction="${URL_}" />`]) {
      expect(e1570(all, wrap(jsx))).toHaveLength(1);
    }
  });

  test("a `srcset` is one E1570 if any absolute candidate is undeclared, and none if each is declared", () => {
    const one = `<img srcset="${URL_} 1x, https://b.example/y 2x" alt="x" />`;
    expect(e1570(decl("img", ORIGIN), wrap(one))).toHaveLength(1);
    expect(e1570(decl("img", "https://b.example"), wrap(one))).toHaveLength(1);
    expect(e1570(decl("img", ORIGIN, "https://b.example"), wrap(one))).toEqual([]);
    const many = `<img srcset="https://b.example/y 1x, https://c.example/z 2x, https://d.example/w 3x" alt="x" />`;
    expect(e1570(undefined, wrap(many))).toHaveLength(1);
    expect(e1570(decl("img", "https://c.example"), wrap(many))).toHaveLength(1);
    const source = `<picture><source srcset="${URL_} 1x, https://b.example/y 2x" /></picture>`;
    expect(e1570(decl("img", ORIGIN), wrap(source))).toHaveLength(1);
  });

  test('`Frame src="/e/1"` is E1570, whatever is declared', () => {
    const jsx = '<Frame src="/e/1" title="Demo" />';
    expect(e1570(undefined, wrap(jsx))).toHaveLength(1);
    expect(e1570(decl("frame", ORIGIN), wrap(jsx))).toHaveLength(1);
  });

  test("a literal `Frame src` that is not absolute is E1570, and an absolute declared one is none", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,8}(\/[a-z]{1,8}){0,2}$/), (p) => {
        const rel = wrap(`<Frame src="/${p}" title="Demo" />`);
        const bare = wrap(`<Frame src="${p}" title="Demo" />`);
        expect(e1570(decl("frame", ORIGIN), rel)).toHaveLength(1);
        expect(e1570(decl("frame", ORIGIN), bare)).toHaveLength(1);
        expect(e1570(decl("frame", ORIGIN), wrap(`<Frame src="${ORIGIN}/${p}" title="Demo" />`))).toEqual([]);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test('`Frame src="https://v.example/e/1"` without `title`, or with `title=" "`, is E1802', () => {
    const files = (jsx: string) =>
      single(decl("frame", "https://v.example"), [{ path: "modules/a/C.tsx", source: wrap(jsx) }]);
    for (const jsx of ['<Frame src="https://v.example/e/1" />', '<Frame src="https://v.example/e/1" title=" " />']) {
      expect(withCode(files(jsx), "E1802")).toHaveLength(1);
    }
    expect(withCode(files('<Frame src="https://v.example/e/1" title="Demo" />'), "E1802")).toEqual([]);
  });
});
