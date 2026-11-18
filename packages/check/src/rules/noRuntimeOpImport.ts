import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { moduleSpecifiers } from "../internal/moduleSpecifiers.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const OPS = /^@keel\/runtime-dom\/ops(?:\/|$)/;

/**
 * E1251 (k.runtime): app code imports a runtime op: a static import, re-export, or dynamic `import()` of
 * `@keel/runtime-dom/ops` (compiler output and the generated entry only). No fix: the JSX that replaces an op
 * is the author's.
 */
export const noRuntimeOpImport: RuleDef = {
  code: "E1251",
  message: "app code imports @keel/runtime-dom/ops; use JSX and If/For/Match from @keel/runtime-dom",
  see: "k.runtime",
  check: ({ file, ast }) =>
    isAppPath(file.path)
      ? moduleSpecifiers(ast, false)
          .filter((m) => OPS.test(m.spec))
          .map((m) => findingAt(file, m.at))
      : [],
};
