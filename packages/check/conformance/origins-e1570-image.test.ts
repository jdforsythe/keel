// Spec: k.origins, clause "`Image src=\"https://a.example/x.png\"` in a module of a deployable declaring `img` `https://a.example` is no E1570; of one that does not, or under `frame` only, it is; `action=\"https://a.example/\"` stays E1570."
// k.origins, Rules "E1570 and E1571 (k.security) do not report a URL whose origin is declared under its directive on each deployable listing the module that holds the file or a file importing it, directly or not (none: every deployable)."
// Seed 1337 (fc.assert below).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, decl, project, single, withCode } from "./origins-support.ts";

const IMAGE = (src: string): string =>
  `import { Image } from '@keel/ui'\nexport default function C() { return <Image src=${JSON.stringify(src)} alt="x" /> }\n`;
const FORM = (action: string): string =>
  `import { Form } from '@keel/forms'\nexport default function C() { return <Form method="POST" action=${JSON.stringify(action)} /> }\n`;
const e1570 = (files: Parameters<typeof withCode>[0]) => withCode(files, "E1570");
const IN_A = (source: string) => [{ path: "modules/a/C.tsx", source }];

describe("k.origins: E1570 at a declared origin", () => {
  test('`Image src="https://a.example/x.png"` in a module of a deployable declaring `img` `https://a.example` is no E1570', () => {
    expect(e1570(single(decl("img", "https://a.example"), IN_A(IMAGE("https://a.example/x.png"))))).toEqual([]);
  });
  test('`Image src="https://a.example/x.png"` in a module of a deployable that declares nothing is E1570', () => {
    expect(e1570(single(undefined, IN_A(IMAGE("https://a.example/x.png"))))).toHaveLength(1);
    expect(e1570(single("{}", IN_A(IMAGE("https://a.example/x.png"))))).toHaveLength(1);
  });
  test('`Image src="https://a.example/x.png"` with the origin under `frame` only is E1570', () => {
    expect(e1570(single(decl("frame", "https://a.example"), IN_A(IMAGE("https://a.example/x.png"))))).toHaveLength(1);
  });
  test("an `Image src` whose origin is not the declared one (another host, port or scheme) is E1570", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,10}$/), (h) => {
        const files = (src: string) => single(decl("img", "https://a.example"), IN_A(IMAGE(src)));
        expect(e1570(files(`https://${h}b.example/x.png`))).toHaveLength(1);
        expect(e1570(files("https://a.example:8443/x.png"))).toHaveLength(1);
        expect(e1570(files("https://sub.a.example/x.png"))).toHaveLength(1);
        expect(e1570(files("http://localhost/x.png"))).toHaveLength(1);
        expect(e1570(files(`https://a.example/${h}.png`))).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
  test('`action="https://a.example/"` stays E1570 with every directive declaring `https://a.example`', () => {
    const all = `{ ${["img", "media", "font", "connect", "frame"].map((k) => `${k}: { 'https://a.example': 'r' }`).join(", ")} }`;
    expect(e1570(single(all, IN_A(FORM("https://a.example/"))))).toHaveLength(1);
  });
  test("a template literal `src` whose head is a declared origin is no E1570", () => {
    const src =
      "import { Image } from '@keel/ui'\nexport default function C(props: { sku: string }) { return <Image src={`https://a.example/${props.sku}/640.webp`} alt=\"x\" /> }\n";
    expect(e1570(single(decl("img", "https://a.example"), IN_A(src)))).toEqual([]);
    expect(e1570(single(undefined, IN_A(src)))).toHaveLength(1);
  });
  const two = (x: string | undefined, y: string | undefined, files: Parameters<typeof project>[1]) =>
    project(
      [
        { name: "x", modules: ["a"], ...(x === undefined ? {} : { origins: x }) },
        { name: "y", modules: ["b"], ...(y === undefined ? {} : { origins: y }) },
      ],
      files,
    );
  const IMG = decl("img", "https://a.example");
  test("a file in a module only deployable `x` lists is read on `x` alone, whatever `y` declares", () => {
    const files = [{ path: "modules/a/C.tsx", source: IMAGE("https://a.example/x.png") }];
    expect(e1570(two(IMG, undefined, files))).toEqual([]);
    expect(e1570(two(undefined, IMG, files))).toHaveLength(1);
    expect(e1570(two(undefined, undefined, files))).toHaveLength(1);
  });
  test("a file in a module two deployables list is read on each: reported unless both declare the origin", () => {
    const files = [{ path: "modules/a/C.tsx", source: IMAGE("https://a.example/x.png") }];
    const both = project(
      [
        { name: "x", modules: ["a"], origins: IMG },
        { name: "y", modules: ["a"] },
      ],
      files,
    );
    expect(e1570(both)).toHaveLength(1);
    const declared = project(
      [
        { name: "x", modules: ["a"], origins: IMG },
        { name: "y", modules: ["a"], origins: IMG },
      ],
      files,
    );
    expect(e1570(declared)).toEqual([]);
  });
  test("a file imported by a file of a module is read on the deployable listing that module, and on no other", () => {
    const files = [
      { path: "shared/Photo.tsx", source: IMAGE("https://a.example/x.png") },
      { path: "modules/a/Page.tsx", source: "import P from '../../shared/Photo.tsx'\nexport default P\n" },
    ];
    expect(e1570(two(IMG, undefined, files))).toEqual([]);
    expect(e1570(two(undefined, IMG, files))).toHaveLength(1);
  });
  test("a file imported by modules of two deployables is read on each: reported unless both declare the origin", () => {
    const shared = [
      { path: "shared/Photo.tsx", source: IMAGE("https://a.example/x.png") },
      { path: "modules/a/Page.tsx", source: "import P from '../../shared/Photo.tsx'\nexport default P\n" },
      { path: "modules/b/Page.tsx", source: "import P from '../../shared/Photo.tsx'\nexport default P\n" },
    ];
    expect(e1570(two(IMG, IMG, shared))).toEqual([]);
    expect(e1570(two(IMG, undefined, shared))).toHaveLength(1);
    expect(e1570(two(undefined, IMG, shared))).toHaveLength(1);
  });
  test("a file imported through another file, not directly, is read on the deployable listing the importing module", () => {
    const files = [
      { path: "shared/Photo.tsx", source: IMAGE("https://a.example/x.png") },
      { path: "shared/Wrap.tsx", source: "import P from './Photo.tsx'\nexport default P\n" },
      { path: "modules/a/Page.tsx", source: "import W from '../../shared/Wrap.tsx'\nexport default W\n" },
    ];
    expect(e1570(two(IMG, undefined, files))).toEqual([]);
    expect(e1570(two(undefined, IMG, files))).toHaveLength(1);
  });
  test("a file no module holds or imports is read on every deployable: reported unless each declares the origin", () => {
    const files = [{ path: "shared/Photo.tsx", source: IMAGE("https://a.example/x.png") }];
    expect(e1570(two(IMG, IMG, files))).toEqual([]);
    expect(e1570(two(IMG, undefined, files))).toHaveLength(1);
    expect(e1570(two(undefined, IMG, files))).toHaveLength(1);
    expect(e1570(single(IMG, files))).toEqual([]);
    expect(e1570(single(undefined, files))).toHaveLength(1);
  });
});
