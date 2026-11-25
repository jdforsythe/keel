// Spec: k.a11y-static, Conformance "With `tokens.ts` exporting `brandTokens`, `keel check` reports one E1804 at the line of the `<Text` of `<Box fg="divider" bg="card"><Text>x</Text></Box>` and none at the `<Box`; for `<Box fg="text" bg="card"><Text>x</Text></Box>` it reports none."
// Spec: k.a11y-static, Conformance "With `brandTokens`, `keel check` reports no E1804 for `<Box bg="card"><Text fg={tone}>x</Text></Box>`, `<Box bg={tone}><Text fg="divider">x</Text></Box>`, `<Box bg="card"><Text {...rest}>x</Text></Box>`, `<Box bg="card"><Panel><Text fg="divider">x</Text></Panel></Box>` with `Panel` an app component, or `<Box bg="card"><Text fg="divider" hidden>x</Text></Box>`, and one for `<Box bg="card"><If when={on}><Text fg="divider">x</Text></If></Box>` and for `<Box bg="card"><Text {...rest} fg="divider" bg="card">x</Text></Box>`."
// Spec: k.a11y-static, Conformance "With color tokens `low` `#787878` and `bg` `#ffffff` and `fontSize` `big` `24px`, `<Box bg="bg" fontSize="big"><Text fg="low">x</Text></Box>` reports no E1804 and `<Box bg="bg"><Text fg="low" fontSize={size}>x</Text></Box>` reports none, while `<Box bg="bg"><Text fg="low">x</Text></Box>` reports one."
// Spec: k.a11y-static, Conformance "With color tokens named by 20 `a`s (`#ffffff`) and 20 `b`s (`#ffffff`), `<Text fg="<a>" bg="<b>">x</Text>` reports E1804 with the message `fg "<a>" on bg "<b>" is 1.00:1 in light, needs 4.5:1` (86 units); with names of 30 characters each the message is 89 units, the first 86 of the whole message and `...`."
// Spec: k.a11y-static, Conformance "`keel check` in a project whose `tokens.ts` exports no `tokens`, throws, or exports `tokens` with `color: { fg: 5 }`, reports one E1807 at `tokens.ts` line 1, column 1, no E1804, and exits 1; in a project with no `tokens.ts` it reports neither for `<Box bg="bg"><Text fg="low">x</Text></Box>`."
// Spec: k.a11y-static, Conformance "In a project with `node_modules`, after a `keel check` that reports no E1804 for `<Box bg="bg"><Text fg="low">x</Text></Box>` with `low` `#111111`, changing `low` in `tokens.ts` to `#787878` makes the next `keel check` report one E1804, the same stdout as a run with `node_modules/.cache/keel` deleted."
// Spec: k.a11y-static, Conformance "`keel build` in a project where `keel check` reports only one E1802, only one E1804, or only one E1820 exits 1, prints that diagnostic and writes no `.keel/` folder and no `dist/` folder."
// Spec: k.a11y-static, Conformance "`keel check`, `keel build`, MCP `check` and `keel lsp`'s published diagnostics report the same static E1804 for one project; after a passing `renderRoute` test of page `m.r` given `artifacts: {}` whose module holds that E1804, `keel ledger` gives `a11y:.:m.r#1.4.3` rung `none`."
// Spec: k.a11y-static, Judged "A `Box` fg reaches its `Text`, and the finding is at the `Text`" (first bullet); `hidden` counts only bare or `{true}`; a string of spaces is not text; a `Text` carrying `bg="card"` after a spread is read (the spread bullet).
// Spec: k.a11y-static, Message "A `base` set or look, judged at `tokens.ts`, prefixes `<set>: ` (`base.link: `). A message over 89 UTF-16 code units keeps its first 86 and ends `...`."
// Spec: k.a11y-static, Judged "`example` needs E1804 among the `rules` of a passing `renderRoute` run of the route (k.a11y Claims)"
// Untestable here: `keel lsp`'s published diagnostics (the in-process `lsp` factory's wire shape is not given by the spec text), so the last bullet's lsp clause is asserted for `keel check`, `keel build` and MCP `check` only.
// Binary runs: 3 before the static-tokens block below; 26 after (brand 1, rich tokens 1, message lengths 1, E1807 x3, cache x3, build gate x4, same-project check 1, MCP 1, ledger 8).
// Spec: k.a11y, Contrast "Statically (E1804), the background is the element's `bg`, else the nearest ancestor's in its component; with neither, render checks it."
// Spec: k.a11y, Conformance "A `Text` whose `fg` is 4.4:1 against the `bg` of its nearest ancestor in the same component is E1804; at `fontSize` 18.66px and `weight` 700, or under `states.disabled`, it is not."
// Spec: k.a11y, Rules "E1804 text below its contrast threshold (static and render)"
// Spec: k.a11y, Contrast "Text needs 4.5:1 against its background, 3:1 when large (`fontSize` >= 24px, or >= 18.66px at `weight` >= 700), per color scheme and breakpoint; text in `states.disabled` is exempt; text without a `fontSize` token is normal size."
// Spec: k.ui, Conformance "`fg="fg" bg="bg"` with the tokens above passes E1804 in both schemes; a pair at 3:1 fails it."
// Seed: 1337 (fixed projects; the message-length pairs are drawn with `fc.sample` at seed 1337; the law over ratios is in the check package's a11y-contrast-inherited.test.ts).
// The real `keel` binary (`keel check --format=json`) over temp projects, as a11y-project-support.ts. The project's `tokens.ts` is read by the binary itself (k.a11y Artifacts names the project's `tokens.ts` as the default for a render; the Contrast text states static E1804 with no other input), so no tokens are handed in.
// Assumed: a diagnostic record is `{ kind: "diag", code, path, line, col, message }`, `path` relative to the project, `line` 1-based at the `<Text` element.
// Spec silent (reported, not asserted): the message of E1804; whether `keel build` refuses an E1804 (k.a11y names no refusal); the static result when `tokens.ts` is absent. The absent case asserts no E1804 and no throw (render checks it, and a render with no `tokens.ts` skips E1804).
// 4.4:1 is `#787878` on `#ffffff` (4.41:1); `#111111` passes; 3:1 is `#949494` on white (2.95:1).
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TOPOLOGY,
  buildAndTest,
  itemRecord,
  keelProject,
  moduleFiles,
  testHead,
  tokensSource,
} from "./a11y-project-support.ts";
import { type CliRecord, type Run, keel, removeProject, writeFiles } from "./test-sim-project.ts";

const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const MODULE = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
const TOKENS = `import { defineTokens } from "@keel/ui";
export const tokens = defineTokens({
  color: { low: "#787878", ok: "#111111", bg: "#ffffff", dark: "#000000" },
  fontSize: { big: "18.66px", sm: "14px" },
  weight: { bold: "700", normal: "400" },
});
`;
const HEAD = `import { Box, Text } from "@keel/ui";\n`;
/** A component file: line 3 holds the one `<Text` unless the body says otherwise. */
const comp = (name: string, body: string): [string, string] => [
  `modules/m/${name}.tsx`,
  `${HEAD}export function ${name}() {\n  return (\n${body}\n  );\n}\n`,
];
const CASES: Record<string, string> = {
  Fails: `    <Box bg="bg">\n      <Text fg="low">x</Text>\n    </Box>`,
  Passes: `    <Box bg="bg">\n      <Text fg="ok">x</Text>\n    </Box>`,
  Own: `    <Box>\n      <Text fg="low" bg="bg">x</Text>\n    </Box>`,
  Inherited: `    <Box bg="bg">\n      <Box>\n        <Text fg="low">x</Text>\n      </Box>\n    </Box>`,
  NearestFails: `    <Box bg="dark">\n      <Box bg="bg">\n        <Text fg="low">x</Text>\n      </Box>\n    </Box>`,
  NearestPasses: `    <Box bg="bg">\n      <Box bg="dark">\n        <Text fg="low">x</Text>\n      </Box>\n    </Box>`,
  Large: `    <Box bg="bg">\n      <Text fg="low" fontSize="big" weight="bold">x</Text>\n    </Box>`,
  SmallBold: `    <Box bg="bg">\n      <Text fg="low" fontSize="sm" weight="bold">x</Text>\n    </Box>`,
  NoSize: `    <Box bg="bg">\n      <Text fg="low" weight="bold">x</Text>\n    </Box>`,
  Disabled: `    <Box bg="bg">\n      <Text fg="ok" states={{ disabled: { fg: "low" } }}>x</Text>\n    </Box>`,
  NoBg: `    <Box>\n      <Text fg="low">x</Text>\n    </Box>`,
};
const files = (): Record<string, string> => ({
  "topology.ts": TOPOLOGY,
  "modules/m/module.ts": MODULE,
  ...Object.fromEntries(Object.entries(CASES).map(([n, b]) => comp(n, b))),
});
const e1804 = (run: Run): CliRecord[] => run.records.filter((r) => r.kind === "diag" && r.code === "E1804");
const at = (run: Run, name: string): CliRecord[] => e1804(run).filter((r) => r.path === `modules/m/${name}.tsx`);

describe("k.a11y: static E1804 through the real `keel check`", () => {
  let withTokens: Run;
  let noTokens: Run;
  beforeAll(() => {
    const a = keelProject("a11y-static-contrast", { ...files(), "tokens.ts": TOKENS });
    created.push(a);
    withTokens = keel(a, ["check"]);
    const b = keelProject("a11y-static-contrast-none", { ...files() });
    created.push(b);
    noTokens = keel(b, ["check"]);
  }, 180_000);

  it("A `Text` whose `fg` is 4.4:1 against the `bg` of its element is E1804 at the element, with a message", () => {
    const d = at(withTokens, "Fails");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: "E1804", path: "modules/m/Fails.tsx", line: 5 });
    expect(typeof d[0]?.message).toBe("string");
    expect(String(d[0]?.message).length).toBeGreaterThan(0);
  });

  it("`keel check` exits 1 when it reports an E1804", () => {
    expect(withTokens.status).toBe(1);
  });

  it("a `Text` at 4.5:1 or better reports no E1804", () => {
    expect(at(withTokens, "Passes")).toEqual([]);
  });

  it("the element's own `bg` is the background", () => {
    expect(at(withTokens, "Own")).toHaveLength(1);
  });

  it("the background inherited from an ancestor's `bg` in the same component is E1804 at the Text", () => {
    const d = at(withTokens, "Inherited");
    expect(d).toHaveLength(1);
    // the layout is stated, not computed: line 1 imports, 2 `export function`, 3 `return (`, then Box 4, Box 5, `<Text` 6; the Text is where the finding sits
    expect(d[0]).toMatchObject({ line: 6 });
  });

  it("the nearest ancestor's `bg` wins over a farther one", () => {
    expect(at(withTokens, "NearestFails")).toHaveLength(1);
    expect(at(withTokens, "NearestPasses")).toEqual([]);
  });

  it("at `fontSize` 18.66px and `weight` 700 it is not E1804", () => {
    expect(at(withTokens, "Large")).toEqual([]);
  });

  it("700 at a smaller size, or bold text without a `fontSize` token, is E1804 (normal size)", () => {
    expect(at(withTokens, "SmallBold")).toHaveLength(1);
    expect(at(withTokens, "NoSize")).toHaveLength(1);
  });

  it("under `states.disabled` it is not E1804", () => {
    expect(at(withTokens, "Disabled")).toEqual([]);
  });

  it("with no `bg` on the element or an ancestor in the component, E1804 does not fire statically", () => {
    expect(at(withTokens, "NoBg")).toEqual([]);
  });

  it("the E1804 set of the whole project is exactly the failing components", () => {
    const paths = e1804(withTokens)
      .map((r) => r.path)
      .sort();
    const want = ["Fails", "Inherited", "NearestFails", "NoSize", "Own", "SmallBold"]
      .map((n) => `modules/m/${n}.tsx`)
      .sort();
    expect(paths).toEqual(want);
  });

  it("a project with no `tokens.ts` reports no E1804 and does not crash", () => {
    expect(e1804(noTokens)).toEqual([]);
    expect(noTokens.records.at(-1)?.kind).toBe("summary");
  });
});

describe("k.a11y: the brand tokens' divider text on card is E1804 through `keel check`", () => {
  let run: Run;
  beforeAll(() => {
    const dir = keelProject("a11y-static-brand", {
      "topology.ts": TOPOLOGY,
      "modules/m/module.ts": MODULE,
      "tokens.ts": `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`,
      ...Object.fromEntries([comp("PairText", `    <Box bg="card">\n      <Text fg="divider">x</Text>\n    </Box>`)]),
    });
    created.push(dir);
    run = keel(dir, ["check"]);
  }, 120_000);

  it('`<Text fg="divider">` over the `bg="card"` of its ancestor is E1804 at the Text', () => {
    expect(at(run, "PairText")).toHaveLength(1);
  });
  // Untestable from the spec text: a `fg` set on a Box with an unstyled Text inside (the repro `<Box fg="divider" bg="card"><Text>x</Text></Box>`); the spec states no static rule for a `fg` that is not on the Text.
});

// ---- k.a11y-static: tokens, values, judged, message, build gate, claim rule ----
const STATIC_HEAD = `import { Box, Text } from "@keel/ui"; import { If } from "@keel/runtime-dom"; const rest = {}, tone = "low", on = true, label = "x", size = "big", items = ["a"], name = "weak";\n`;
/** A component file whose first body line is line 4: line 1 holds imports and constants, 2 `export function`, 3 `return (`. */
const unit = (name: string, body: string): [string, string] => [
  `modules/m/${name}.tsx`,
  `${STATIC_HEAD}export function ${name}() {\n  return (\n${body}\n  );\n}\n`,
];
/** The finding count of a component file of a run. */
const count = (run: Run, name: string): number => at(run, name).length;
const ind = (s: string): string =>
  s
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");
const project = (prefix: string, files: Record<string, string>): string => {
  const dir = keelProject(prefix, { "topology.ts": TOPOLOGY, "modules/m/module.ts": MODULE, ...files });
  created.push(dir);
  return dir;
};

describe("k.a11y-static: brandTokens", () => {
  const FILES: Record<string, string> = {
    BoxFg: `<Box fg="divider" bg="card">\n  <Text>x</Text>\n</Box>`,
    BoxFgOk: `<Box fg="text" bg="card">\n  <Text>x</Text>\n</Box>`,
    BoxFgNested: `<Box fg="divider" bg="card">\n  <Box>\n    <Text>x</Text>\n  </Box>\n</Box>`,
    BoxFgOverridden: `<Box fg="divider" bg="card">\n  <Text fg="text">x</Text>\n</Box>`,
    FgExpr: `<Box bg="card">\n  <Text fg={tone}>x</Text>\n</Box>`,
    BgExpr: `<Box bg={tone}>\n  <Text fg="divider">x</Text>\n</Box>`,
    SpreadOnly: `<Box bg="card">\n  <Text {...rest}>x</Text>\n</Box>`,
    PanelAround: `<Box bg="card">\n  <Panel>\n    <Text fg="divider">x</Text>\n  </Panel>\n</Box>`,
    PanelInside: `<Panel>\n  <Text fg="divider" bg="card">x</Text>\n</Panel>`,
    Hidden: `<Box bg="card">\n  <Text fg="divider" hidden>x</Text>\n</Box>`,
    HiddenTrue: `<Box bg="card">\n  <Text fg="divider" hidden={true}>x</Text>\n</Box>`,
    HiddenFalse: `<Box bg="card">\n  <Text fg="divider" hidden={false}>x</Text>\n</Box>`,
    HiddenExpr: `<Box bg="card">\n  <Text fg="divider" hidden={on}>x</Text>\n</Box>`,
    HiddenOnBox: `<Box bg="card" hidden>\n  <Text fg="divider">x</Text>\n</Box>`,
    DisabledBare: `<Box bg="card">\n  <Text fg="divider" disabled>x</Text>\n</Box>`,
    AriaDisabled: `<Box bg="card">\n  <Text fg="divider" aria-disabled="true">x</Text>\n</Box>`,
    AriaNotDisabled: `<Box bg="card">\n  <Text fg="divider" aria-disabled="false">x</Text>\n</Box>`,
    IfPasses: `<Box bg="card">\n  <If when={on}>\n    <Text fg="divider">x</Text>\n  </If>\n</Box>`,
    SpreadThenProps: `<Box bg="card">\n  <Text {...rest} fg="divider" bg="card">x</Text>\n</Box>`,
    SpreadThenPropsAlone: `<Text {...rest} fg="divider" bg="card">x</Text>`,
    SpreadAfterProps: `<Text fg="divider" bg="card" {...rest}>x</Text>`,
    Spaces: `<Box bg="card">\n  <Text fg="divider">   </Text>\n</Box>`,
    SpacesExpr: `<Box bg="card">\n  <Text fg="divider">{"  "}</Text>\n</Box>`,
    Empty: `<Box bg="card">\n  <Text fg="divider"></Text>\n</Box>`,
    OnlyExpression: `<Box bg="card">\n  <Text fg="divider">{label}</Text>\n</Box>`,
    CondString: `<Box bg="card">\n  <Text fg="divider">{on ? "a" : "b"}</Text>\n</Box>`,
    LogicalJsx: `<Box bg="card">\n  <Text fg="divider">{on && <Box />}</Text>\n</Box>`,
    MapCall: `<Box bg="card">\n  <Text fg="divider">{items.map((i) => i)}</Text>\n</Box>`,
    FnChild: `<Box bg="card">\n  <Text fg="divider">{() => "x"}</Text>\n</Box>`,
    ResponsiveFg: `<Box bg="card">\n  <Text fg={{ base: "divider" }}>x</Text>\n</Box>`,
  };
  let run: Run;
  beforeAll(() => {
    const dir = project("a11y-static-brand-all", {
      "tokens.ts": `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`,
      ...Object.fromEntries(
        Object.entries(FILES).map(([n, b]) => {
          const [path, src] = unit(n, ind(b));
          const withPanel = src.replace(
            "export function",
            "const Panel = (p: { children?: unknown }) => p.children;\nexport function",
          );
          return [path, withPanel];
        }),
      ),
    });
    run = keel(dir, ["check"]);
  }, 240_000);

  it('With `tokens.ts` exporting `brandTokens`, `keel check` reports one E1804 at the line of the `<Text` of `<Box fg="divider" bg="card"><Text>x</Text></Box>` and none at the `<Box`', () => {
    // the Panel line is inserted at line 2 of the file, so every body line below is one lower than `unit` states: Box 5, Text 6
    const d = at(run, "BoxFg");
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(6);
    expect(d.filter((r) => r.line === 5)).toEqual([]);
  });

  it('for `<Box fg="text" bg="card"><Text>x</Text></Box>` it reports none', () => {
    expect(count(run, "BoxFgOk")).toBe(0);
  });

  it("a `Box` fg reaches a nested `Text`, and a `Text`'s own `fg` replaces it", () => {
    expect(count(run, "BoxFgNested")).toBe(1);
    expect(count(run, "BoxFgOverridden")).toBe(0);
  });

  it("`keel check` reports no E1804 for an expression `fg`, an expression `bg`, a bare spread, an app-component boundary or `hidden`", () => {
    for (const n of ["FgExpr", "BgExpr", "SpreadOnly", "PanelAround", "Hidden", "ResponsiveFg"]) {
      expect(count(run, n), n).toBe(0);
    }
  });

  it('a `Text` with its own `bg="card"` inside an app component is judged: the boundary hides only what comes from outside it', () => {
    expect(count(run, "PanelInside")).toBe(1);
  });

  it('`<Box bg="card"><If when={on}><Text fg="divider">x</Text></If></Box>` reports one E1804', () => {
    expect(count(run, "IfPasses")).toBe(1);
  });

  it('`<Box bg="card"><Text {...rest} fg="divider" bg="card">x</Text></Box>` reports one E1804, with or without the `Box`', () => {
    expect(count(run, "SpreadThenProps")).toBe(1);
    expect(count(run, "SpreadThenPropsAlone")).toBe(1);
  });

  it("a spread that follows the props leaves them unread: no E1804", () => {
    expect(count(run, "SpreadAfterProps")).toBe(0);
  });

  it('`hidden` exempts only when written bare or `{true}`; `disabled` bare and `aria-disabled="true"` exempt; `hidden` on a `Box` its values pass through exempts', () => {
    for (const n of ["Hidden", "HiddenTrue", "HiddenOnBox", "DisabledBare", "AriaDisabled"])
      expect(count(run, n), n).toBe(0);
    for (const n of ["HiddenFalse", "HiddenExpr", "AriaNotDisabled"]) expect(count(run, n), n).toBe(1);
  });

  it('a string of spaces is not text: a JSX text of spaces, `{"  "}` and an empty `Text` are not judged', () => {
    for (const n of ["Spaces", "SpacesExpr", "Empty"]) expect(count(run, n), n).toBe(0);
  });

  it("text that is only an expression is text: `{label}` and a conditional with only text branches are judged; a JSX branch, a `.map` and a function are not", () => {
    expect(count(run, "OnlyExpression")).toBe(1);
    expect(count(run, "CondString")).toBe(1);
    for (const n of ["LogicalJsx", "MapCall", "FnChild"]) expect(count(run, n), n).toBe(0);
  });
});

describe("k.a11y-static: values, thresholds and schemes from the project's tokens", () => {
  const TOK = `import { defineTokens } from "@keel/ui";
export const tokens = defineTokens({
  color: {
    low: "#777777", ok: "#767676", bg: "#ffffff", dark: "#000000", pale: "#bbbbbb",
    duo: { light: "#111111", dark: "#333333" }, dbg: { light: "#ffffff", dark: "#000000" },
  },
  fontSize: { big: "24px", under: "23.99px", lg: "18.66px", lgUnder: "18.65px" },
  weight: { bold: "700", semi: "699" },
  base: { link: { fg: "low", bg: "bg" } },
});
`;
  const FILES: Record<string, string> = {
    // 4.54:1 passes, 4.48:1 fails: one step either side of 4.5
    StepPass: `<Box bg="bg">\n  <Text fg="ok">x</Text>\n</Box>`,
    StepFail: `<Box bg="bg">\n  <Text fg="low">x</Text>\n</Box>`,
    Big24: `<Box bg="bg" fontSize="big">\n  <Text fg="low">x</Text>\n</Box>`,
    Under24: `<Box bg="bg" fontSize="under">\n  <Text fg="low">x</Text>\n</Box>`,
    Bold1866: `<Box bg="bg">\n  <Text fg="low" fontSize="lg" weight="bold">x</Text>\n</Box>`,
    Bold1865: `<Box bg="bg">\n  <Text fg="low" fontSize="lgUnder" weight="bold">x</Text>\n</Box>`,
    Weight699: `<Box bg="bg">\n  <Text fg="low" fontSize="lg" weight="semi">x</Text>\n</Box>`,
    UnreadSizePasses: `<Box bg="bg">\n  <Text fg="low" fontSize={size}>x</Text>\n</Box>`,
    UnreadSizeFails: `<Box bg="bg">\n  <Text fg="pale" fontSize={size}>x</Text>\n</Box>`,
    UnreadWeightPasses: `<Box bg="bg">\n  <Text fg="low" weight={size}>x</Text>\n</Box>`,
    DarkOnly: `<Box bg="dbg">\n  <Text fg="duo">x</Text>\n</Box>`,
    ChainEnd: `<Box bg="dark">\n  <Text>x</Text>\n</Box>`,
    ChainEndOk: `<Box bg="bg">\n  <Text>x</Text>\n</Box>`,
    BoxFgReaches: `<Box fg="low" bg="bg">\n  <Text>x</Text>\n</Box>`,
  };
  let run: Run;
  beforeAll(() => {
    const dir = project("a11y-static-rich", {
      "tokens.ts": TOK,
      ...Object.fromEntries(Object.entries(FILES).map(([n, b]) => unit(n, ind(b)))),
    });
    run = keel(dir, ["check"]);
  }, 240_000);

  it("a pair that passes at 4.54:1 reports none and the next step down, 4.48:1, reports one", () => {
    expect(count(run, "StepPass")).toBe(0);
    expect(count(run, "StepFail")).toBe(1);
    expect(at(run, "StepFail")[0]?.message).toBe('fg "low" on bg "bg" is 4.48:1 in light, needs 4.5:1');
  });

  it("large text is `fontSize` >= 24px, or >= 18.66px at `weight` >= 700: each limit passes and one step under it fails", () => {
    expect(count(run, "Big24")).toBe(0);
    expect(count(run, "Under24")).toBe(1);
    expect(count(run, "Bold1866")).toBe(0);
    expect(count(run, "Bold1865")).toBe(1);
    expect(count(run, "Weight699")).toBe(1);
  });

  it("with an unread `fontSize` or `weight` the threshold is 3:1, which text of every size needs", () => {
    expect(count(run, "UnreadSizePasses")).toBe(0);
    expect(count(run, "UnreadWeightPasses")).toBe(0);
    const d = at(run, "UnreadSizeFails");
    expect(d).toHaveLength(1);
    expect(String(d[0]?.message)).toMatch(/, needs 3:1$/);
  });

  it("a pair that fails only in the dark scheme is reported with that scheme named", () => {
    const d = at(run, "DarkOnly");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('fg "duo" on bg "dbg" is 1.66:1 in dark, needs 4.5:1');
  });

  it("the chain's end gives text `#000000`: black text over a black `bg` is E1804 and over white is not", () => {
    expect(count(run, "ChainEnd")).toBe(1);
    expect(count(run, "ChainEndOk")).toBe(0);
  });

  it("a `Box` `fg` reaches its `Text`, with the nearest ancestor's `bg`", () => {
    expect(count(run, "BoxFgReaches")).toBe(1);
  });

  it("a `base` set judged at `tokens.ts` prefixes its message with `base.link: `", () => {
    const d = run.records.filter((r) => r.kind === "diag" && r.code === "E1804" && r.path === "tokens.ts");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('base.link: fg "low" on bg "bg" is 4.48:1 in light, needs 4.5:1');
  });
});

describe("k.a11y-static: a `fg` set by a look and overridden by a prop", () => {
  const TOK = `import { defineTokens } from "@keel/ui";
export const tokens = defineTokens({
  color: { low: "#777777", ok: "#767676", bg: "#ffffff" },
  look: { weak: { fg: "low" }, firm: { fg: "ok" } },
});
`;
  const FILES: Record<string, string> = {
    LookFails: `<Box bg="bg">\n  <Text look="weak">x</Text>\n</Box>`,
    LookOverriddenUp: `<Box bg="bg">\n  <Text look="weak" fg="ok">x</Text>\n</Box>`,
    LookOverriddenDown: `<Box bg="bg">\n  <Text look="firm" fg="low">x</Text>\n</Box>`,
    LookComputed: `<Box bg="bg">\n  <Text look={name}>x</Text>\n</Box>`,
  };
  let run: Run;
  beforeAll(() => {
    const dir = project("a11y-static-look", {
      "tokens.ts": TOK,
      ...Object.fromEntries(Object.entries(FILES).map(([n, b]) => unit(n, ind(b)))),
    });
    run = keel(dir, ["check"]);
  }, 240_000);

  it("the `fg` of a string-literal `look` is judged, and the element's own `fg` prop replaces it either way", () => {
    expect(count(run, "LookFails")).toBe(1);
    expect(count(run, "LookOverriddenUp")).toBe(0);
    expect(count(run, "LookOverriddenDown")).toBe(1);
  });

  it("a `look` that is not a string literal leaves its values unread: no E1804", () => {
    expect(count(run, "LookComputed")).toBe(0);
  });
});

describe("k.a11y-static: the message and its 89-unit limit", () => {
  const PAIRS: { a: string; b: string }[] = [
    { a: "a".repeat(20), b: "b".repeat(20) },
    { a: "c".repeat(22), b: "d".repeat(21) },
    { a: "e".repeat(22), b: "f".repeat(22) },
    { a: "g".repeat(30), b: "h".repeat(30) },
    ...fc
      .sample(fc.tuple(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 40 })), { seed: 1337, numRuns: 6 })
      .map(([la, lb], i) => ({
        a: String.fromCharCode(105 + 2 * i).repeat(la),
        b: String.fromCharCode(106 + 2 * i).repeat(lb),
      })),
  ];
  const whole = (a: string, b: string): string => `fg "${a}" on bg "${b}" is 1.00:1 in light, needs 4.5:1`;
  const limited = (m: string): string => (m.length > 89 ? `${m.slice(0, 86)}...` : m);
  let run: Run;
  beforeAll(() => {
    const colors = PAIRS.flatMap(({ a, b }) => [`${a}: "#ffffff"`, `${b}: "#ffffff"`]).join(", ");
    const dir = project("a11y-static-msg", {
      "tokens.ts": `import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { ${colors} } });\n`,
      ...Object.fromEntries(PAIRS.map(({ a, b }, i) => unit(`P${i}`, `    <Text fg="${a}" bg="${b}">x</Text>`))),
    });
    run = keel(dir, ["check"]);
  }, 240_000);

  it("a message of 86, of 89 and of 90 units is whole, whole, and cut to its first 86 plus `...`", () => {
    // the fixtures' own lengths, stated so a wrong fixture fails here and not silently
    expect(whole(PAIRS[0]?.a ?? "", PAIRS[0]?.b ?? "")).toHaveLength(86);
    expect(whole(PAIRS[1]?.a ?? "", PAIRS[1]?.b ?? "")).toHaveLength(89);
    expect(whole(PAIRS[2]?.a ?? "", PAIRS[2]?.b ?? "")).toHaveLength(106 - 16);
    expect(at(run, "P0")[0]?.message).toBe(whole(PAIRS[0]?.a ?? "", PAIRS[0]?.b ?? ""));
    expect(at(run, "P1")[0]?.message).toBe(whole(PAIRS[1]?.a ?? "", PAIRS[1]?.b ?? ""));
    const cut = String(at(run, "P2")[0]?.message);
    expect(cut).toBe(`${whole(PAIRS[2]?.a ?? "", PAIRS[2]?.b ?? "").slice(0, 86)}...`);
    expect(cut).toHaveLength(89);
  });

  it("with names of 30 characters each the message is 89 units, the first 86 of the whole message and `...`", () => {
    const m = String(at(run, "P3")[0]?.message);
    expect(m).toBe(`${whole(PAIRS[3]?.a ?? "", PAIRS[3]?.b ?? "").slice(0, 86)}...`);
    expect(m).toHaveLength(89);
  });

  it("property: for any two name lengths the message is whole up to 89 units and else its first 86 plus `...`", () => {
    PAIRS.forEach(({ a, b }, i) => {
      const got = at(run, `P${i}`);
      expect(got, `P${i}`).toHaveLength(1);
      expect(got[0]?.message).toBe(limited(whole(a, b)));
    });
  });
});

describe("k.a11y-static: a broken `tokens.ts` is E1807 at 1:1 and nothing is judged", () => {
  const COMP = unit("Fails", `    <Box bg="bg">\n      <Text fg="low">x</Text>\n    </Box>`);
  const BROKEN: Record<string, string> = {
    throws: `export const tokens = JSON.parse("{");\n`,
    "no tokens export": "export {};\n",
    "fails TokenSchema": "export const tokens = { color: { fg: 5 } };\n",
  };
  const runs = new Map<string, Run>();
  beforeAll(() => {
    for (const [label, src] of Object.entries(BROKEN)) {
      const dir = project("a11y-static-e1807", { "tokens.ts": src, [COMP[0]]: COMP[1] });
      runs.set(label, keel(dir, ["check"]));
    }
  }, 360_000);

  it("`keel check` in a project whose `tokens.ts` throws, exports no `tokens`, or exports `tokens` with `color: { fg: 5 }`, reports one E1807 at `tokens.ts` line 1, column 1, no E1804, and exits 1", () => {
    expect(runs.size).toBe(3);
    for (const [label, r] of runs) {
      const d = r.records.filter((x) => x.kind === "diag" && x.code === "E1807");
      expect(d, label).toHaveLength(1);
      expect(d[0], label).toMatchObject({ path: "tokens.ts", line: 1, col: 1 });
      expect(e1804(r), label).toEqual([]);
      expect(r.status, label).toBe(1);
    }
  });

  it('in a project with no `tokens.ts` it reports neither E1807 nor E1804 for `<Box bg="bg"><Text fg="low">x</Text></Box>`', () => {
    // the first suite's `noTokens` project holds that Box and Text as `Fails.tsx`
    const none = keel(project("a11y-static-none", { [COMP[0]]: COMP[1] }), ["check"]);
    expect(none.records.filter((r) => r.kind === "diag" && (r.code === "E1807" || r.code === "E1804"))).toEqual([]);
  });
});

describe("k.a11y-static: the tokens are read on every run, never from a cache", () => {
  it("after a `keel check` with no E1804 for `low` `#111111`, changing `low` to `#787878` makes the next `keel check` report one E1804, the same stdout as a run with `node_modules/.cache/keel` deleted", () => {
    const comp = unit("Fails", `    <Box bg="bg">\n      <Text fg="low">x</Text>\n    </Box>`);
    const tok = (low: string): string =>
      `import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { low: "${low}", bg: "#ffffff" } });\n`;
    const dir = project("a11y-static-cache", { "tokens.ts": tok("#111111"), [comp[0]]: comp[1] });
    expect(e1804(keel(dir, ["check"]))).toEqual([]);
    writeFiles(dir, { "tokens.ts": tok("#787878") });
    const changed = keel(dir, ["check"]);
    expect(at(changed, "Fails")).toHaveLength(1);
    rmSync(join(dir, "node_modules", ".cache", "keel"), { recursive: true, force: true });
    const fresh = keel(dir, ["check"]);
    expect(changed.stdout).toBe(fresh.stdout);
  }, 240_000);
});

describe("k.a11y-static: E1802, E1804, E1807 and E1820 make `keel build` exit 1 and write nothing", () => {
  const BTN = "<Button onClick={() => {}}>A</Button><Button onClick={() => {}}>B</Button>";
  const GOOD = tokensSource("#111111");
  const cases: { code: string; files: Record<string, string> }[] = [
    {
      code: "E1802",
      files: {
        "tokens.ts": GOOD,
        "modules/m/Nav.tsx": `import { Box } from "@keel/ui";\nexport const Nav = () => (\n  <Box as="nav" label="">x</Box>\n);\n`,
      },
    },
    {
      code: "E1804",
      files: {
        "tokens.ts": tokensSource("#777777"),
        ...Object.fromEntries([unit("Fails", `    <Box bg="bg">\n      <Text fg="fg">x</Text>\n    </Box>`)]),
      },
    },
    { code: "E1807", files: { "tokens.ts": `export const tokens = JSON.parse("{");\n` } },
    {
      code: "E1820",
      files: {
        "tokens.ts": GOOD,
        "modules/m/Rev.tsx": `import { Box, Button } from "@keel/ui";\nexport const Rev = () => (\n  <Box direction="row-reverse">${BTN}</Box>\n);\n`,
      },
    },
  ];
  for (const { code, files } of cases) {
    it(`\`keel build\` in a project where \`keel check\` reports only one ${code} exits 1, prints that diagnostic and writes no \`.keel/\` folder and no \`dist/\` folder`, () => {
      const dir = project(`a11y-static-build-${code}`, files);
      const checked = keel(dir, ["check"]);
      const errors = (r: Run): CliRecord[] =>
        r.records.filter((x) => x.kind === "diag" && String(x.code).startsWith("E"));
      expect(errors(checked).map((x) => x.code)).toEqual([code]);
      const built = keel(dir, ["build"]);
      expect(built.status).toBe(1);
      expect(
        errors(built).map((x) => `${x.code} ${x.path}`),
        built.stdout,
      ).toEqual([`${code} ${String(errors(checked)[0]?.path)}`]);
      expect(existsSync(join(dir, ".keel"))).toBe(false);
      expect(existsSync(join(dir, "dist"))).toBe(false);
    }, 240_000);
  }
});

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "bin.ts");
const mcpCheck = (cwd: string): string => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_") || k === "NODE_OPTIONS" || k === "TEST")
      continue;
    env[k] = v;
  }
  const request = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "check", arguments: {} } };
  return spawnSync(process.execPath, [BIN, "mcp"], {
    cwd,
    encoding: "utf8",
    env,
    input: `${JSON.stringify(request)}\n`,
  }).stdout;
};

describe("k.a11y-static: one static E1804 on every surface, and the claim rule", () => {
  it("`keel check`, `keel build` and MCP `check` report the same static E1804 for one project", () => {
    const files = {
      "tokens.ts": tokensSource("#777777"),
      ...Object.fromEntries([unit("Fails", `    <Box bg="bg">\n      <Text fg="fg">x</Text>\n    </Box>`)]),
    };
    const dir = project("a11y-static-surfaces", files);
    const viaCheck = at(keel(dir, ["check"]), "Fails");
    const viaBuild = at(keel(dir, ["build"]), "Fails");
    expect(viaCheck).toHaveLength(1);
    expect(viaBuild).toHaveLength(1);
    expect(viaBuild[0]).toMatchObject({ code: "E1804", line: viaCheck[0]?.line, message: viaCheck[0]?.message });
    const viaMcp = mcpCheck(dir);
    expect(viaMcp).toContain("E1804");
    expect(viaMcp).toContain(String(viaCheck[0]?.message).replaceAll('"', '\\"'));
  }, 240_000);

  const ITEM = "a11y:.:m.r#1.4.3";
  const BAD = unit("Bad", `    <Box bg="bg">\n      <Text fg="fg">x</Text>\n    </Box>`);
  const EMPTY = `${testHead(false)}
it("renders r given no tokens", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx(), artifacts: {} });
  expect(h.find("m.r.msg").text).toBe("r");
  h.dispose();
});
`;
  const GIVEN = `${testHead(true)}
it("renders r given the tokens", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx(), artifacts: { tokens } });
  expect(h.find("m.r.msg").text).toBe("r");
  h.dispose();
});
`;
  const routeProject = (prefix: string, fg: string, test: string): string =>
    project(prefix, { ...moduleFiles(["r"], true), "tokens.ts": tokensSource(fg), "modules/m/test/r.test.ts": test });

  it("a route whose only contrast evidence is static (a clean check, a render given `artifacts: {}`) has `a11y:.:m.r#1.4.3` rung `none`", () => {
    const dir = routeProject("a11y-static-claim-none", "#111111", EMPTY);
    expect(buildAndTest(dir).status).toBe(0);
    expect(itemRecord(keel(dir, ["ledger"]), ITEM)).toMatchObject({ rung: "none" });
  }, 360_000);

  it("after a passing `renderRoute` test of `m.r` given `artifacts: {}` whose module holds a static E1804, `keel ledger` gives `a11y:.:m.r#1.4.3` rung `none`", () => {
    const dir = routeProject("a11y-static-claim-e1804", "#777777", EMPTY);
    expect(buildAndTest(dir).status).toBe(0);
    writeFiles(dir, { [BAD[0]]: BAD[1] });
    expect(itemRecord(keel(dir, ["ledger"]), ITEM)).toMatchObject({ rung: "none" });
  }, 360_000);

  it("a route rendered under `keel test` with the tokens, E1804 among the `rules` of a passing run, has rung `example`, and a static E1804 in its module makes it `none`", () => {
    const dir = routeProject("a11y-static-claim-example", "#111111", GIVEN);
    expect(buildAndTest(dir).status).toBe(0);
    expect(itemRecord(keel(dir, ["ledger"]), ITEM)).toMatchObject({ rung: "example" });
    writeFiles(dir, { "tokens.ts": tokensSource("#777777"), [BAD[0]]: BAD[1] });
    expect(itemRecord(keel(dir, ["ledger"]), ITEM)).toMatchObject({ rung: "none" });
  }, 360_000);
});
