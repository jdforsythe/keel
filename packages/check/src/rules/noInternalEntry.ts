import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import { moduleSpecifiers } from "../internal/moduleSpecifiers.ts";
import { str } from "../internal/str.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const INTERNAL = /^@keel\/[^/]+\/(?:[^/]+\/)*internal(?:\/|$)/;

/** Kernel and stdlib code (this repo's `packages/`, a project's `node_modules/`) and generated `.keel/` output, at the root. */
const LIBRARY = /^(?:packages|node_modules|\.keel)\//;

/**
 * E1576 (k.security): a file outside `packages/`, `node_modules/` and `.keel/` (app code, tests, `unsafe/`, tool
 * scripts) names a `@keel/*` entry with an `internal` path segment in an import (type-only too), a re-export, or a
 * literal `import()` or `require()`, or any `#` specifier (a package `imports` alias, which no `package.json` the
 * checker reads can resolve). One finding per statement or call. No fix: the public replacement is the
 * author's.
 */
export const noInternalEntry: RuleDef = {
  code: "E1576",
  message: (f) =>
    str(f.data, "spec").startsWith("#")
      ? `${str(f.data, "spec")} may name a Keel internal entry; use a relative path or package name`
      : `${str(f.data, "spec")} is internal to Keel packages; use a public entry`,
  see: "k.security",
  check: ({ file, ast }) =>
    isCodePath(file.path) && !LIBRARY.test(file.path)
      ? moduleSpecifiers(ast, true)
          .filter((m) => INTERNAL.test(m.spec) || m.spec.startsWith("#"))
          .map((m) => findingAt(file, m.at, { spec: m.spec }))
      : [],
};
