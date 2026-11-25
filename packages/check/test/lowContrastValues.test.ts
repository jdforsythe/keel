// k.a11y-static Values, Judged and Message: how static E1804 resolves fg, bg, fontSize and weight.
import { brandTokens } from "@keel/ui/brand";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const e1804 = (jsx: string, tokens: unknown = brandTokens) =>
  check(
    [
      {
        path: "modules/m/C.tsx",
        source: `import { Box, Button, Link, Text } from '@keel/ui'\nimport { If } from '@keel/runtime-dom'\nimport { Panel } from './Panel.tsx'\nexport default function C(props) {\n  const { tone, rest, on, size, items } = props\n  return (\n${jsx}\n  )\n}\n`,
      },
    ],
    { artifacts: { tokens }, types: false },
  ).diagnostics.filter((d) => d.code === "E1804" && !/^(?:base|look)\./.test(d.message));

describe("k.a11y-static: values pass from a container to its text", () => {
  it("a fg on a Box reaches the Text inside it, judged at the Text and not at the Box", () => {
    const d = e1804('<Box fg="divider" bg="card">\n<Text>x</Text>\n</Box>');
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(8);
    expect(e1804('<Box fg="text" bg="card">\n<Text>x</Text>\n</Box>')).toEqual([]);
  });
  it("a fg and a bg set two levels up both reach the text", () => {
    expect(e1804('<Box fg="divider"><Box bg="card"><Box><Text>x</Text></Box></Box></Box>')).toHaveLength(1);
  });
  it("a Box that sets fg and holds no text is not judged", () => {
    expect(e1804('<Box fg="divider" bg="card"><Text fg="text">x</Text></Box>')).toEqual([]);
  });
  it("a role's set outranks the parent's value, as at render", () => {
    // base.link fg is `text`: on a `text` bg it is 1:1.
    expect(e1804('<Box bg="text" fg="card"><Link to="/a">a</Link></Box>')).toHaveLength(1);
    expect(e1804('<Box bg="text" fg="card"><Text>a</Text></Box>')).toEqual([]);
    expect(e1804('<Box bg="card"><Button>Go</Button></Box>')).toEqual([]);
  });
  it("values pass through If, not through an app component", () => {
    expect(e1804('<Box bg="card"><If when={on}><Text fg="divider">x</Text></If></Box>')).toHaveLength(1);
    expect(e1804('<Box bg="card"><Panel><Text fg="divider">x</Text></Panel></Box>')).toEqual([]);
  });
  it("a fontSize or weight on an ancestor sets the threshold", () => {
    const t = { color: { low: "#787878", bg: "#ffffff" }, fontSize: { big: "24px" }, weight: { bold: "700" } };
    expect(e1804('<Box bg="bg" fontSize="big"><Text fg="low">x</Text></Box>', t)).toEqual([]);
    expect(e1804('<Box bg="bg"><Text fg="low">x</Text></Box>', t)).toHaveLength(1);
    expect(e1804('<Box bg="bg"><Text fg="low" fontSize={size}>x</Text></Box>', t)).toEqual([]);
  });
  it("an unread size judges at 3:1", () => {
    const t = { color: { faint: "#aaaaaa", bg: "#ffffff" } };
    expect(e1804('<Box bg="bg"><Text fg="faint" fontSize={size}>x</Text></Box>', t)).toHaveLength(1);
  });
});

describe("k.a11y-static: what check does not read is left to the render", () => {
  it.each([
    '<Box bg="card"><Text fg={tone}>x</Text></Box>',
    '<Box bg={tone}><Text fg="divider">x</Text></Box>',
    '<Box bg="card"><Text {...rest}>x</Text></Box>',
    '<Box bg="card"><Text fg="divider" {...rest}>x</Text></Box>',
    '<Box bg="card"><Text look={tone}>x</Text></Box>',
    '<Box bg="card"><Text fg={{ base: "divider" }}>x</Text></Box>',
    '<Text fg="divider">x</Text>',
  ])("%s reports no E1804", (jsx) => {
    expect(e1804(jsx)).toEqual([]);
  });
  it("a literal written after the spread is read", () => {
    expect(e1804('<Box bg="card"><Text {...rest} fg="divider" bg="card">x</Text></Box>')).toHaveLength(1);
    expect(e1804('<Box bg="card"><Text {...rest} fg="divider">x</Text></Box>')).toEqual([]);
  });
});

describe("k.a11y-static: what holds text and what is exempt", () => {
  it.each([
    '<Box bg="card"><Text fg="divider" hidden>x</Text></Box>',
    '<Box bg="card" hidden><Text fg="divider">x</Text></Box>',
    '<Box bg="card"><Button fg="textSecondary" disabled={true}>x</Button></Box>',
    '<Box bg="card"><Text fg="divider" aria-disabled="true">x</Text></Box>',
    '<Box fg="divider" bg="card">{items.map((i) => <Text fg="text">{i}</Text>)}</Box>',
    '<Box fg="divider" bg="card">{() => <Text fg="text">x</Text>}</Box>',
    '<Box fg="divider" bg="card">{on ? <Text fg="text">x</Text> : null}</Box>',
    '<Box fg="divider" bg="card">{" "}</Box>',
  ])("%s reports no E1804", (jsx) => {
    expect(e1804(jsx)).toEqual([]);
  });
  it.each([
    '<Box fg="divider" bg="card">{tone}</Box>',
    '<Box bg="card"><Button fg="textSecondary" disabled={on}>x</Button></Box>',
    '<Box fg="divider" bg="card">{on ? "a" : "b"}</Box>',
  ])("%s reports one E1804", (jsx) => {
    expect(e1804(jsx)).toHaveLength(1);
  });
});

describe("k.a11y-static: the message", () => {
  it("names the two tokens, the ratio found and the one needed", () => {
    const [d] = e1804('<Box fg="divider" bg="card"><Text>x</Text></Box>');
    expect(d?.message).toBe('fg "divider" on bg "card" is 1.27:1 in light, needs 4.5:1');
  });
  it("is the whole message at 86 units and clipped to 89 units ending ... above it", () => {
    const at = (n: number) => {
      const [a, b] = ["a".repeat(n), "b".repeat(n)];
      const [d] = e1804(`<Text fg="${a}" bg="${b}">x</Text>`, { color: { [a]: "#ffffff", [b]: "#ffffff" } });
      return { d, whole: `fg "${a}" on bg "${b}" is 1.00:1 in light, needs 4.5:1` };
    };
    const short = at(20);
    expect(short.d?.message).toBe(short.whole);
    expect(short.whole).toHaveLength(86);
    const long = at(30);
    expect(long.d?.message).toBe(`${long.whole.slice(0, 86)}...`);
    expect(long.d?.message).toHaveLength(89);
  });
});

describe("k.a11y-static: the law over inherited values", () => {
  const hex = (n: number): string => `#${n.toString(16).padStart(2, "0").repeat(3)}`;
  const lum = (n: number): number => {
    const c = n / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const ratioOf = (a: number, b: number): number =>
    (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  it("a fg and a bg at any depth above the text fire exactly when the pair is below 4.5:1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        (a, b, fgDepth, bgDepth) => {
          const r = ratioOf(a, b);
          fc.pre(Math.abs(r - 4.5) > 0.01);
          const depth = Math.max(fgDepth, bgDepth) + 1;
          let jsx = "<Text>x</Text>";
          for (let i = 1; i <= depth; i++) {
            const props = `${i === fgDepth + 1 ? ' fg="f"' : ""}${i === bgDepth + 1 ? ' bg="b"' : ""}`;
            jsx = `<Box${props}>${jsx}</Box>`;
          }
          const t = { color: { f: hex(a), b: hex(b) } };
          expect(e1804(jsx, t).length).toBe(r < 4.5 ? 1 : 0);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});
