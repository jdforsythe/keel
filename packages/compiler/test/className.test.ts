// The compiler's copy of ui's class-name scheme (src/internal/className.ts) must agree with ui's own, and the
// classes the compiler writes for static style props must be exactly the rules ui's compileStyles emits.
// ui is imported from the repository root, in this test only (the compiler package never depends on @keel/ui).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "@keel/compiler";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { className } from "../src/internal/className.ts";

const ui = path.join(repoRoot(import.meta.dirname), "packages", "ui", "src");
const styles: typeof import("../../ui/src/css/compileStyles.ts") = await import(
  pathToFileURL(path.join(ui, "css", "compileStyles.ts")).href
);
const uiNames: typeof import("../../ui/src/internal/className.ts") = await import(
  pathToFileURL(path.join(ui, "internal", "className.ts")).href
);
const { compileStyles } = styles;
const uiClassName = uiNames.className;

const STATES = [undefined, "hover", "focusVisible", "active", "disabled"] as const;

describe("className (copy of @keel/ui's)", () => {
  it("matches ui for a fixture of readable and hashed names", () => {
    const cases: [string, string, string | undefined, (typeof STATES)[number]][] = [
      ["p", "2", undefined, undefined],
      ["p", "3", "md", undefined],
      ["bg", "accent", undefined, "hover"],
      ["fg", "fg", "md", "focusVisible"],
      ["justify", "space-between", undefined, undefined],
      ["w", "1/2", "hover", "disabled"],
      ["gap", "x.y", "lg", "active"],
    ];
    for (const [prop, token, bp, state] of cases) {
      expect(className(prop, token, bp, state)).toBe(uiClassName(prop, token, bp, state));
    }
  });

  it("matches ui for generated inputs (seed 1337)", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.option(fc.string(), { nil: undefined }),
        fc.constantFrom(...STATES),
        (prop, token, bp, state) => className(prop, token, bp, state) === uiClassName(prop, token, bp, state),
      ),
      { seed: 1337 },
    );
  });

  it("every class written for static style props is a rule of compileStyles over styles.json", () => {
    const r = compile([
      {
        path: "modules/a/Card.tsx",
        source: `import { Box } from "@keel/ui";
export default function Card() {
  return <Box p={{ base: "2", md: "3" }} bg="bg" states={{ hover: { bg: "accent" }, focusVisible: { fg: "fg" } }}>x</Box>;
}`,
      },
    ]);
    const tokens = {
      color: { fg: { light: "#111", dark: "#eee" }, bg: "#fff", accent: "#0a5" },
      space: { 2: "8px", 3: "16px" },
      breakpoint: { md: "768px" },
    };
    const { css } = compileStyles({ tokens, usages: r.artifacts["styles.json"].usages });
    const m = /class: "([^"]+)"/.exec(r.outputs[0]?.code ?? "");
    const classes = (m?.[1] ?? "").split(" ");
    expect(classes).toEqual(["k-p-2", "k-md-p-3", "k-bg-bg", "k-hover-bg-accent", "k-focus-fg-fg"]);
    for (const c of classes) expect(css).toContain(`.${c}`);
  });
});
