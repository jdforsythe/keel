import type { Program } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import { moduleSpecifiers } from "../internal/moduleSpecifiers.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Kernel and stdlib code and generated output, at the project root. */
const LIBRARY = /^(?:packages|node_modules|\.keel)\//;
const UNSAFE = /(?:^|\/)unsafe\//;
/** `@keel/ui/aria`, a path inside it, or a path into the package's `aria` source (a relative `node_modules/...` too). */
const ARIA = /^@keel\/ui\/aria(?:\/|$)|(?:^|\/)@keel\/ui\/(?:src\/|dist\/)?aria(?:\/|\.|$)/;

/** True when the statement starting at `at` is an `export ... from`. */
const reexports = (ast: Program, at: number): boolean =>
  ast.body.some(
    (st) => st.start === at && (st.type === "ExportAllDeclaration" || st.type === "ExportNamedDeclaration"),
  );

/**
 * E1822 (k.aria): a file outside the project root's `packages/`, `node_modules/` and `.keel/`, tests included, names
 * `@keel/ui/aria` (or a path into it) in an import, a re-export, or a literal `import()` or `require()`; a file under
 * `unsafe/` may import it but not re-export it. One finding per statement or call. No fix. A package `imports` alias
 * (`#aria`) is E1576 instead.
 */
export const ariaImport: RuleDef = {
  code: "E1822",
  message: () => "@keel/ui/aria is for stdlib widgets; use a @keel/std-headless widget",
  explain: "Widget parts carry ARIA contracts a stdlib widget keeps; app code uses the widget.",
  see: "k.aria",
  check: ({ file, ast }) =>
    isCodePath(file.path) && !LIBRARY.test(file.path)
      ? moduleSpecifiers(ast, true)
          .filter((m) => ARIA.test(m.spec) && (!UNSAFE.test(file.path) || reexports(ast, m.at)))
          .map((m) => findingAt(file, m.at, {}))
      : [],
};
