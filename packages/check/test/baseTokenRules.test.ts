// k.ui E1801 for looks and token sets; k.a11y E1804 over the `base` roles, `base.page` and looks.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const COLOR = { ink: "#111111", mid: "#949494", white: "#ffffff", black: "#000000", paper: "#f5f5f5" };
const codes = (jsx: string, code: string, tokens: object, extra: { path: string; source: string }[] = []) =>
  check(
    [
      {
        path: "src/C.tsx",
        source: `import { Box, Button, Heading, Text } from '@keel/ui'\nexport default function C(props) { return ${jsx} }\n`,
      },
      ...extra,
    ],
    { types: false, artifacts: { tokens } },
  ).diagnostics.filter((d) => d.code === code);

describe("E1801 looks and token sets", () => {
  const tokens = { color: COLOR, space: { 2: "8px" }, look: { primary: { fg: "ink", px: "2" } } };
  it("a literal look the tokens lack, on an element, a Part or in a part style", () => {
    expect(codes('<Button look="primary">a</Button>', "E1801", tokens)).toEqual([]);
    const [d] = codes('<Button look="nope">a</Button>', "E1801", tokens);
    expect(d?.message).toBe('look="nope" is not a look token');
    expect(codes(`<Part look={'nope'} />`, "E1801", tokens)).toHaveLength(1);
    expect(codes(`<Box styles={{ field: { look: 'nope' } }} />`, "E1801", tokens)).toHaveLength(1);
    expect(codes(`<Box styles={{ field: { look: 'primary' } }} />`, "E1801", tokens)).toEqual([]);
  });
  it("a computed look, or no tokens artifact, is not read", () => {
    expect(codes("<Button look={props.l}>a</Button>", "E1801", tokens)).toEqual([]);
    const none = check(
      [{ path: "src/C.tsx", source: `export default function C() { return <Button look="x" /> }\n` }],
      {
        types: false,
      },
    ).diagnostics;
    expect(none.filter((d) => d.code === "E1801")).toEqual([]);
  });
  it("a set naming a missing token or breakpoint is reported once, at tokens.ts", () => {
    const bad = {
      ...tokens,
      base: { button: { px: "9", states: { hover: { fg: { md: "ink" } } } }, focus: "nope" },
    };
    const tokensTs = { path: "src/tokens.ts", source: "export const tokens = { base: { button: {} } }\n" };
    const ds = check(
      [
        { path: "src/C.tsx", source: "export default function C() { return null }\n" },
        { path: "src/D.tsx", source: "export default function D() { return null }\n" },
        tokensTs,
      ],
      { types: false, artifacts: { tokens: bad } },
    ).diagnostics.filter((d) => d.code === "E1801");
    expect(ds.map((d) => [d.path, d.message]).sort()).toEqual(
      [
        ["src/tokens.ts", 'base.button px="9" is not a space token'],
        ["src/tokens.ts", 'base.button.states.hover fg breakpoint "md" is not a breakpoint token'],
        ["src/tokens.ts", 'base.focus "nope" is not a color token'],
      ].sort(),
    );
  });
});

/** E1804 findings at elements, leaving out the token set ones. */
const atElements = (jsx: string, tokens: object) =>
  codes(jsx, "E1804", tokens).filter((d) => !/^(?:base|look)\./.test(d.message));

describe("E1804 reads the base sets", () => {
  it("the page default is base.page's fg and bg", () => {
    const t = { color: COLOR, base: { page: { fg: "mid", bg: "white" } } };
    expect(atElements('<Box bg="white">x</Box>', t)).toHaveLength(1);
    expect(atElements('<Box bg="white" fg="ink">x</Box>', t)).toEqual([]);
    expect(atElements('<Box bg="white"><Text>x</Text></Box>', t)).toHaveLength(1);
    // `base.page`'s bg is the page's, not found inside a component: the render check judges it.
    expect(atElements('<Box fg="ink">x</Box>', { color: COLOR, base: { page: { bg: "black" } } })).toEqual([]);
  });
  it("a role's fg and bg fill what the element does not set", () => {
    const t = { color: COLOR, base: { button: { fg: "white", bg: "black" } } };
    expect(atElements('<Button bg="white">a</Button>', t)).toHaveLength(1);
    expect(atElements('<Button fg="mid">a</Button>', t)).toEqual([]);
    expect(
      atElements('<Box bg="white"><Heading level={1}>a</Heading></Box>', {
        color: COLOR,
        base: { heading: { fg: "mid" } },
      }),
    ).toHaveLength(1);
  });
  it("each base set and look is judged at tokens.ts, on its bg or the page's", () => {
    const t = {
      color: COLOR,
      base: { page: { fg: "ink", bg: "white" }, link: { fg: "mid" }, focus: "ink" },
      look: { quiet: { fg: "mid", bg: "paper" }, fine: { fg: "ink" } },
    };
    const ds = codes("<Box />", "E1804", t);
    expect(ds.map((d) => d.message)).toEqual([
      'base.link: fg "mid" on bg "white" is 3.03:1 in light, needs 4.5:1',
      'look.quiet: fg "mid" on bg "paper" is 2.78:1 in light, needs 4.5:1',
    ]);
  });
});
