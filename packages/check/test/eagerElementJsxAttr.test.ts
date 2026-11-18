// k.claim Check and Order: compiled JSX lowers an element-valued prop to a getter, so `<Card icon={<Icon />} />` makes
// the element inside the component's build and is not E1258; the call form `Card({ icon: Icon() })` is.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const CARD = {
  path: "modules/app/Card.tsx",
  source:
    "import { Box } from '@keel/ui'\nexport function Card(props: { icon?: unknown }) { return <Box>{props.icon}</Box> }\nexport function Icon() { return <Box>i</Box> }\n",
};
const e1258 = (body: string) =>
  check(
    [
      CARD,
      {
        path: "modules/app/Page.tsx",
        source: `import { Card, Icon } from './Card.tsx'\nexport default function Page() { return ${body} }\n`,
      },
    ],
    { types: false },
  ).diagnostics.filter((d) => d.code === "E1258");

describe("E1258 and an inline JSX element in a JSX attribute", () => {
  it("does not report `<Card icon={<Icon />} />`: the compiler passes it as a getter", () => {
    expect(e1258("<Card icon={<Icon />} />")).toEqual([]);
  });

  it("reports the call form `Card({ icon: Icon() })`", () => {
    expect(e1258("Card({ icon: Icon() })")).toHaveLength(1);
  });
});
