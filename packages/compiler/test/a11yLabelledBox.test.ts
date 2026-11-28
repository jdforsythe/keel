// a11y.json for a labelled `Box` (its `label` is written as `aria-label`, k.ui): the role and name source the
// rendered element has. `Part` (k.aria) and stdlib widgets are not base elements and get no entry.
import { compile } from "@keel/compiler";
import { describe, expect, test } from "vitest";

const a11y = (imports: string, jsx: string) => {
  const r = compile([{ path: "C.tsx", source: `${imports}\nexport default function C() { return ${jsx} }\n` }]);
  expect(r.diagnostics).toEqual([]);
  return r.artifacts["a11y.json"];
};
const UI = "import { Box } from '@keel/ui'";

describe("a11y.json for a labelled Box", () => {
  test.each([
    ["nav", "navigation"],
    ["aside", "complementary"],
    ["section", "region"],
    ["main", "main"],
  ])("`Box as=%s label` is role %s named by aria", (as, role) => {
    expect(a11y(UI, `<Box id="b" as="${as}" label="Main">x</Box>`)).toEqual({ b: { name: "aria", role, tag: as } });
  });

  test("an unlabelled `section` is not a region and is unnamed", () => {
    expect(a11y(UI, '<Box id="b" as="section">x</Box>').b).toMatchObject({ name: "none", tag: "section" });
    expect(a11y(UI, '<Box id="b" as="section">x</Box>').b?.role).not.toBe("region");
  });

  test("`Part` and a stdlib widget's parts get no entry", () => {
    expect(
      a11y("import { Part } from '@keel/ui/aria'", '<Part id="o" role="option" selected={false}>x</Part>'),
    ).toEqual({});
    expect(
      a11y("import { Listbox } from '@keel/std-headless'", '<Listbox id="l" label="Fruit" options={() => []} />'),
    ).toEqual({});
  });
});
