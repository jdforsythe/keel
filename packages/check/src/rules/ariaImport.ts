import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import { moduleSpecifiers } from "../internal/moduleSpecifiers.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Kernel and stdlib code, generated output, and `unsafe/` directories. */
const EXEMPT = /(?:^|\/)(?:packages|node_modules|\.keel|unsafe)\//;

/**
 * E1822 (k.aria): a file outside `packages/`, `node_modules/`, `.keel/` and `unsafe/`, tests included, imports or
 * re-exports `@keel/ui/aria`. One finding per statement or call. No fix.
 */
export const ariaImport: RuleDef = {
  code: "E1822",
  message: () => "@keel/ui/aria is for stdlib widgets; use a @keel/std-headless widget",
  explain: "Widget parts carry ARIA contracts a stdlib widget keeps; app code uses the widget.",
  see: "k.aria",
  check: ({ file, ast }) =>
    isCodePath(file.path) && !EXEMPT.test(file.path)
      ? moduleSpecifiers(ast, true)
          .filter((m) => m.spec === "@keel/ui/aria")
          .map((m) => findingAt(file, m.at, {}))
      : [],
};
