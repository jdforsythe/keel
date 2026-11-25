// Spec: k.a11y, Rules "E1802 missing or blank a11y-required prop · E1804 text below its contrast threshold (static and render) · E1820 reversed `direction` over focusable elements (static and render) · E1821 a control bound to a `.pii()` field without `autocomplete` (render) · E1826 a `status` region inserted holding text (render; no criterion in Claims)."
// Spec: k.a11y, Conformance "`keel check` without types reports E1802 for `<Box as="nav" label="">` and `Input({ label: " " })`; `label="Main"`, `label={name}` and a `store` option `label: ""` report none."
// Spec: k.a11y, Conformance "A `Box` with `direction="row-reverse"` over two `Button`s is E1820 and its fix leaves `direction="row"` with the children reversed; over one `Button` it is clean."
// Spec: k.a11y, Conformance "`keel check` without types reports E1802 for `<Box scroll="x">`, for `<Box scroll="x" label="Prices" labelledBy="t">` and for `<Box scroll="x" label=" ">`; `label="Prices"`, `label={name}` and `labelledBy="t"` report none."
// Seed: 1337 (fixed projects).
// The static a11y codes (E1802, E1804, E1820; the rest of the Rules line is render-only) seen through the real `keel check` binary. E1804 is in a11y-static-contrast-cli.test.ts.
// The binary reads the project's own files; these cases hand it no types flag, so what the binary does with types is its own. Assumed: a diagnostic record is `{ kind: "diag", code, path, line }`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TOPOLOGY, keelProject } from "./a11y-project-support.ts";
import { type CliRecord, type Run, keel, removeProject } from "./test-sim-project.ts";

const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const MODULE = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
const UI = `import { Box, Button, Input } from "@keel/ui";\n`;
const view = (name: string, body: string): [string, string] => [
  `modules/m/${name}.tsx`,
  `${UI}export const ${name} = (name: string) => (\n  ${body}\n);\n`,
];
const BTN = `<Button onClick={() => {}}>A</Button><Button onClick={() => {}}>B</Button>`;
const FILES: [string, string][] = [
  view("NavBlank", `<Box as="nav" label="">x</Box>`),
  view("NavOk", `<Box as="nav" label="Main">x</Box>`),
  view("InputBlank", `<Input label=" " autocomplete="off" />`),
  view("InputOk", `<Input label={name} autocomplete="off" />`),
  view("ScrollBare", `<Box scroll="x">x</Box>`),
  view("ScrollBoth", `<Box scroll="x" label="Prices" labelledBy="t">x</Box>`),
  view("ScrollBlank", `<Box scroll="x" label=" ">x</Box>`),
  view("ScrollOk", `<Box scroll="x" label="Prices">x</Box>`),
  view("Reversed", `<Box direction="row-reverse">${BTN}</Box>`),
  view("ReversedColumn", `<Box direction="column-reverse">${BTN}</Box>`),
  view("ReversedOne", `<Box direction="row-reverse"><Button onClick={() => {}}>A</Button></Box>`),
  view("Forward", `<Box direction="row">${BTN}</Box>`),
];
const tokens = `import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { fg: "#111111", bg: "#ffffff" } });\n`;
const hit = (run: Run, code: string, name: string): CliRecord[] =>
  run.records.filter((r) => r.kind === "diag" && r.code === code && r.path === `modules/m/${name}.tsx`);

describe("k.a11y: the static a11y codes through the real `keel check`", () => {
  let run: Run;
  beforeAll(() => {
    const dir = keelProject("a11y-static-codes", {
      "topology.ts": TOPOLOGY,
      "modules/m/module.ts": MODULE,
      "tokens.ts": tokens,
      ...Object.fromEntries(FILES),
    });
    created.push(dir);
    run = keel(dir, ["check"]);
  }, 180_000);

  it('`keel check` reports E1802 for `<Box as="nav" label="">` and `Input({ label: " " })`', () => {
    expect(hit(run, "E1802", "NavBlank")).toHaveLength(1);
    expect(hit(run, "E1802", "InputBlank")).toHaveLength(1);
  });

  it('`label="Main"` and `label={name}` report no E1802', () => {
    expect(hit(run, "E1802", "NavOk")).toEqual([]);
    expect(hit(run, "E1802", "InputOk")).toEqual([]);
  });

  it('`keel check` reports E1802 for `<Box scroll="x">`, for `label` with `labelledBy`, and for `label=" "`', () => {
    for (const n of ["ScrollBare", "ScrollBoth", "ScrollBlank"]) expect(hit(run, "E1802", n)).toHaveLength(1);
  });

  it('`<Box scroll="x" label="Prices">` reports no E1802', () => {
    expect(hit(run, "E1802", "ScrollOk")).toEqual([]);
  });

  it('A `Box` with `direction="row-reverse"` over two `Button`s is E1820', () => {
    expect(hit(run, "E1820", "Reversed")).toHaveLength(1);
    expect(hit(run, "E1820", "ReversedColumn")).toHaveLength(1);
  });

  it('over one `Button`, or with `direction="row"`, no E1820', () => {
    expect(hit(run, "E1820", "ReversedOne")).toEqual([]);
    expect(hit(run, "E1820", "Forward")).toEqual([]);
  });

  it("E1821 and E1826 are render-only: `keel check` reports neither", () => {
    expect(run.records.filter((r) => r.kind === "diag" && (r.code === "E1821" || r.code === "E1826"))).toEqual([]);
  });
});
