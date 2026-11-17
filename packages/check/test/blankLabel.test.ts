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

  it("reads a label of only white space character references as blank", () => {
    const src = `${UI}export const A = () => <Box as="nav" label="&#32;" />\nexport const B = () => <Box as="nav" label="&#x20;&nbsp;" />\nexport const C = () => <Box as="nav" label="&#65;" />\nexport const D = () => <Box as="nav" label="&amp;" />\n`;
    expect(out([f("modules/a/A.tsx", src)])).toHaveLength(2);
  });
});
