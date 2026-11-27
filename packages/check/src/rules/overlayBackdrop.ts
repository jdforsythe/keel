import { combosIn } from "../internal/contrast/combosIn.ts";
import { judgeElements } from "../internal/contrast/judgeElements.ts";
import { findingAt } from "../internal/findingAt.ts";
import { fitNames } from "../internal/fitNames.ts";
import { fixElsewhere } from "../internal/fixElsewhere.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { projectLooks } from "../internal/looks/projectLooks.ts";
import { overAddFix } from "../internal/overAddFix.ts";
import { str } from "../internal/str.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1817 (k.a11y-static Overlays): in an app or library file, a `bg` overlay (k.values Overlays) whose element's chain finds a
 * backdrop its `over` does not hold, or a backdrop that is itself an overlay, at the opening quote of the overlay's
 * literal. From `keel check` only: the render check composites over the painted backdrop. The message fits 89 units by
 * clipping its names (`fitNames`). Fix (k.themes Fixes): for a missing backdrop, `"<backdrop>"` added after the last
 * element of the overlay's `over` in `tokens.ts` when that is an array literal of fewer than 8 names; an overlay on an
 * overlay has none. Tokens come from the `tokens` project artifact; without it the rule reports nothing.
 */
export const overlayBackdrop: RuleDef = {
  code: "E1817",
  message: (f) => {
    const prop = str(f.data, "prop");
    const names = [str(f.data, "overlay"), str(f.data, "backdrop")];
    return str(f.data, "kind") === "overlay"
      ? fitNames(([o, b]) => `${prop} "${o}" sits on overlay "${b}"`, names)
      : fitNames(([o, b]) => `${prop} "${o}" sits on "${b}", not in its over`, names);
  },
  see: "k.a11y-static",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = artifacts.tokens;
    if (tokens === undefined) return [];
    const looks = projectLooks.get(project);
    if (!isAppPath(file.path) && looks?.libraryFileOf(file.path) === undefined) return [];
    const combos = combosIn(tokens, looks?.ownSchemes, looks?.ownThemes);
    return judgeElements(ast, tokens, combos).backdrops.map(({ at, bad }) => {
      const finding = findingAt(file, at, bad);
      const fix = bad.kind === "missing" ? overAddFix(project, bad.overlay ?? "", bad.backdrop ?? "") : undefined;
      if (fix !== undefined) fixElsewhere.set(finding, fix);
      return finding;
    });
  },
};
