// E1802 for a blank literal label: message, position, scope and literal forms (k.a11y).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });
const UI = "import { Box, Input, TextArea } from '@keel/ui'\n";
const out = (files: SourceFile[]): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1802")
    .map((d) => `${d.path} ${d.line}:${d.col} ${d.message}${d.fix === undefined ? "" : " +fix"}`);

describe("E1802 blank label", () => {
  it("names the element and what the label names, at the attribute, no fix", () => {
    const src = `${UI}export const A = () => <Box as="nav" label=" ">x</Box>\nexport const B = () => <Input label="" />\n`;
    expect(out([f("modules/a/A.tsx", src)])).toEqual([
      "modules/a/A.tsx 2:38 <Box> label is blank; it must name the landmark",
      "modules/a/A.tsx 3:31 <Input> label is blank; it must name the control",
    ]);
  });

  it("reads a call's first object argument, a quoted key and a plain template", () => {
    const src = `${UI}export const a = Box({ as: "nav", "label": \`\` })\nexport const b = TextArea({ label: '\\u00a0' })\n`;
    expect(out([f("modules/a/v.ts", src)])).toHaveLength(2);
  });

  it("skips computed values, other keys, a second argument and unrelated imports", () => {
    const src = `${UI}const l = ''\nexport const a = [Box({ label: l }), Box({ as: "nav", [l]: '' }), Input({ x: 1 }, { label: '' })]\nexport const b = <Input label={l} />\n`;
    expect(out([f("modules/a/v.tsx", src)])).toEqual([]);
    const own = "import { Box } from './Box.tsx'\nexport const a = <Box label='' />\n";
    expect(out([f("modules/a/w.tsx", own)])).toEqual([]);
  });

  it("skips test files and unsafe/ directories", () => {
    const src = `${UI}export const a = Box({ label: '' })\n`;
    expect(out([f("modules/a/v.test.ts", src), f("modules/a/unsafe/v.ts", src)])).toEqual([]);
  });

  it("reports each blank label once, in source order", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom("", " ", "\t", "Main"), { minLength: 1, maxLength: 6 }), (labels) => {
        const body = labels.map((l, i) => `export const v${i} = Input({ label: ${JSON.stringify(l)} })\n`).join("");
        const lines = out([f("modules/a/v.ts", `${UI}${body}`)]).map((s) => Number(s.split(" ")[1]?.split(":")[0]));
        const want = labels.flatMap((l, i) => (l.trim() === "" ? [i + 2] : []));
        expect(lines).toEqual(want);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});

describe("E1802 namespace import and character references", () => {
  const NS = "import * as ui from '@keel/ui'\n";
  it("follows a namespace import in JSX and in a call", () => {
    const src = `${NS}export const A = () => <ui.Box as="nav" label="">x</ui.Box>\nexport const b = ui.Input({ label: ' ' })\nexport const c = () => <ui.Box as="nav" label="ok" />\n`;
    expect(out([f("modules/a/A.tsx", src)])).toHaveLength(2);
  });

  it("reads a label of only white space or named character references as blank", () => {
    const src = `${UI}export const A = () => <Box as="nav" label="&#32;" />\nexport const B = () => <Box as="nav" label="&#x20;&nbsp;" />\nexport const C = () => <Box as="nav" label="&#65;" />\nexport const D = () => <Box as="nav" label="&amp;" />\n`;
    expect(out([f("modules/a/A.tsx", src)])).toHaveLength(3);
  });
});

describe("E1802 through parentheses, type assertions and object-literal spreads", () => {
  /** A blank literal in each wrapper that changes no value. */
  const wraps = (lit: string): string[] => [
    `(${lit})`,
    `${lit} as string`,
    `${lit} satisfies string`,
    `(${lit} as const)`,
    `((${lit}))`,
  ];

  it("reads a wrapped blank literal in a JSX attribute and in a call", () => {
    for (const w of wraps('""')) {
      const src = `${UI}export const A = () => <Input label={${w}} />\nexport const b = Input({ label: ${w} })\n`;
      expect(out([f("modules/a/A.tsx", src)])).toHaveLength(2);
    }
  });

  it("reads a wrapped call argument and object-literal spreads, in JSX and in a call", () => {
    const src = `${UI}export const a = Input(({ label: "" }))\nexport const b = Input({ label: "" } as const)\nexport const c = Input({ ...{ label: " " } })\nexport const D = () => <Input {...{ label: "" }} />\nexport const E = () => <Input {...({ ...{ label: \`\` } })} />\n`;
    expect(out([f("modules/a/A.tsx", src)]).map((s) => s.split(" ")[1]?.split(":")[0])).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
  });

  it("leaves wrapped names, computed values and spreads of a variable unchecked", () => {
    const src = `${UI}const o = { label: "" }\nexport const a = Input({ label: ("Name") as string })\nexport const b = Input({ ...o })\nexport const C = () => <Input {...o} />\nexport const d = Input({ label: (o.label) as string })\n`;
    expect(out([f("modules/a/A.tsx", src)])).toEqual([]);
  });

  it("fires for any generated white-space label behind any wrapper", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[ \t\n 　]*$/), fc.integer({ min: 0, max: 4 }), (ws, i) => {
        const w = wraps(JSON.stringify(ws))[i] ?? "";
        const src = `${UI}export const A = () => <Input label={${w}} />\nexport const b = Input({ ...{ label: ${w} } })\n`;
        expect(out([f("modules/a/A.tsx", src)])).toHaveLength(2);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});

describe("E1802 and invisible characters", () => {
  it("reads a label of only invisible characters as blank", () => {
    const src = `${UI}export const A = () => <Input label={"\\u200b"} />\nexport const B = () => <Input label="&#x2800;" />\nexport const C = () => <Input label={"\\u3164"} />\n`;
    expect(out([f("modules/a/A.tsx", src)])).toHaveLength(3);
  });

  it("reads a lone mark, a format character and a variation selector as blank, and a visible character with them as not", () => {
    const src = `${UI}export const A = () => <Input label={"\\u0301\\u200e\\ufe0f"} />\nexport const B = () => <Input label={"\\u2764\\ufe0f"} />\nexport const C = () => <Input label="&#8203;x" />\n`;
    expect(out([f("modules/a/A.tsx", src)])).toEqual([
      "modules/a/A.tsx 2:31 <Input> label is blank; it must name the control",
    ]);
  });

  it("reads any code point mix as blank exactly when std.text's visible test finds none", () => {
    const VISIBLE = /[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cf}\p{M}\p{Cc}\u2800]/u;
    const pool = [
      0x1, 0x7f, 0x85, 0x20, 0xa0, 0x200b, 0x200d, 0x2060, 0xfeff, 0x301, 0x2800, 0x3164, 0x61, 0x4e00, 0x1f600, 0xfe0f,
    ];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...pool), { minLength: 1, maxLength: 5 }), (cps) => {
        const text = String.fromCodePoint(...cps);
        const ref = cps.map((c) => `&#x${c.toString(16)};`).join("");
        const src = `${UI}export const A = () => <Input label={${JSON.stringify(text)}} />\nexport const B = () => <Input label="${ref}" />\nexport const C = Input({ label: ${JSON.stringify(text)} })\n`;
        expect(out([f("modules/a/A.tsx", src)])).toHaveLength(VISIBLE.test(text) ? 0 : 3);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("E1802, named character references and control characters", () => {
  it("reads a label whose only visible characters sit in named references as blank, and one with a visible character outside as not", () => {
    const src = `${UI}export const A = () => <Input label="&zwnj;" />\nexport const B = () => <Input label="&copy;" />\nexport const C = () => <Input label="&emsp;&shy;&foo;" />\nexport const D = () => <Input label="&copy;2" />\nexport const E = () => <Input label="&COPY;x" />\n`;
    expect(out([f("modules/a/A.tsx", src)]).map((l) => l.split(" ")[1])).toEqual(["2:31", "3:31", "4:31"]);
  });

  it("reads a label of only control characters as blank, in a string, a call and a numeric reference", () => {
    const src = `${UI}export const A = () => <Input label={"\\u0001"} />\nexport const b = Input({ label: "\\u0001\\u009f" })\nexport const C = () => <Input label="&#0;&#x7f;" />\nexport const D = () => <Input label={"\\u0001a"} />\n`;
    expect(out([f("modules/a/A.tsx", src)])).toHaveLength(3);
  });

  it("reads a label of only a lone surrogate as blank, as std-text's line refuses it, and one beside a letter as not", () => {
    const src = `${UI}export const A = () => <Input label={"\\uD800"} />\nexport const b = Input({ label: "\\uDC00\\u200b" })\nexport const C = () => <Input label="&#xD800;" />\nexport const D = () => <Input label={"a\\uD800"} />\n`;
    expect(out([f("modules/a/A.tsx", src)])).toHaveLength(3);
  });

  it("reads any run of named references as blank, and one ASCII letter outside them as not", () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,7}$/), { minLength: 1, maxLength: 4 }),
        fc.constantFrom("", "a", "Z"),
        (names, letter) => {
          const ref = names.map((n) => `&${n};`).join("");
          const src = `${UI}export const A = () => <Input label="${ref}${letter}" />\n`;
          expect(out([f("modules/a/A.tsx", src)])).toHaveLength(letter === "" ? 1 : 0);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});
