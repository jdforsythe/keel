// Spec: k.a11y, Contrast "Statically (E1804), the background is the element's `bg`, else the nearest ancestor's in its component; with neither, render checks it."
// Spec: k.a11y, Conformance "A `Text` whose `fg` is 4.4:1 against the `bg` of its nearest ancestor in the same component is E1804; at `fontSize` 18.66px and `weight` 700, or under `states.disabled`, it is not."
// Spec: k.a11y, Rules "E1804 text below its contrast threshold (static and render)"
// Spec: k.a11y, Contrast "Text needs 4.5:1 against its background, 3:1 when large (`fontSize` >= 24px, or >= 18.66px at `weight` >= 700), per color scheme and breakpoint; text in `states.disabled` is exempt; text without a `fontSize` token is normal size."
// Spec: k.ui, Conformance "`fg="fg" bg="bg"` with the tokens above passes E1804 in both schemes; a pair at 3:1 fails it."
// Seed: 1337 (fixed projects, no random input; the law over ratios is in the check package's a11y-contrast-inherited.test.ts).
// The real `keel` binary (`keel check --format=json`) over temp projects, as a11y-project-support.ts. The project's `tokens.ts` is read by the binary itself (k.a11y Artifacts names the project's `tokens.ts` as the default for a render; the Contrast text states static E1804 with no other input), so no tokens are handed in.
// Assumed: a diagnostic record is `{ kind: "diag", code, path, line, col, message }`, `path` relative to the project, `line` 1-based at the `<Text` element.
// Spec silent (reported, not asserted): the message of E1804; whether `keel build` refuses an E1804 (k.a11y names no refusal); the static result when `tokens.ts` is absent. The absent case asserts no E1804 and no throw (render checks it, and a render with no `tokens.ts` skips E1804).
// 4.4:1 is `#787878` on `#ffffff` (4.41:1); `#111111` passes; 3:1 is `#949494` on white (2.95:1).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TOPOLOGY, keelProject } from "./a11y-project-support.ts";
import { type CliRecord, type Run, keel, removeProject } from "./test-sim-project.ts";

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
    expect(d[0]).toMatchObject({ line: 7 });
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
