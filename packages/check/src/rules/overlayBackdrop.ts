import { combosIn } from "../internal/contrast/combosIn.ts";
import { judgeElements } from "../internal/contrast/judgeElements.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { projectLooks } from "../internal/looks/projectLooks.ts";
import { str } from "../internal/str.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1817 (k.a11y-static Overlays): in an app or library file, a `bg` overlay (k.values Overlays) whose element's chain finds a
 * backdrop its `over` does not hold, or a backdrop that is itself an overlay, at the opening quote of the overlay's
 * literal. From `keel check` only: the render check composites over the painted backdrop. Fix: none. Tokens come from
 * the `tokens` project artifact; without it the rule reports nothing.
 */
export const overlayBackdrop: RuleDef = {
  code: "E1817",
  message: (f) =>
    str(f.data, "kind") === "overlay"
      ? `${str(f.data, "prop")} "${str(f.data, "overlay")}" sits on overlay "${str(f.data, "backdrop")}"`
      : `${str(f.data, "prop")} "${str(f.data, "overlay")}" sits on "${str(f.data, "backdrop")}", not in its over`,
  see: "k.a11y-static",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = artifacts.tokens;
    if (tokens === undefined) return [];
    const looks = projectLooks.get(project);
    if (!isAppPath(file.path) && looks?.libraryFileOf(file.path) === undefined) return [];
    const combos = combosIn(tokens, looks?.ownSchemes, looks?.ownThemes);
    return judgeElements(ast, tokens, combos).backdrops.map(({ at, bad }) => findingAt(file, at, bad));
  },
};
