import type { AtPath } from "./AtPath.ts";
import type { Change } from "./Change.ts";
import type { Counts } from "./Counts.ts";
import { callCounts } from "./callCounts.ts";

const TEST = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const CODE = /\.[cm]?[jt]sx?$/;
const CONFIG =
  /^(?:tsconfig[^/]*\.json|biome\.jsonc?|\.eslintrc[^/]*|eslint\.config\.[^/]+|\.oxlintrc[^/]*|oxlint\.config\.[^/]+|vitest\.config\.[^/]+|vitest\.workspace\.[^/]+|vite\.config\.[^/]+)$/;
const KINDS: readonly (readonly [keyof Counts, string])[] = [
  ["pii", ".pii("],
  ["secret", "s.secret("],
  ["guard", "guard("],
];

const baseName = (p: string): string => p.slice(p.lastIndexOf("/") + 1);
const at = (path: string, code: string, message: string): AtPath => ({
  path,
  raw: { code, line: 1, col: 1, text: message, message },
});

/** A `package.json`'s `scripts` as one comparable text; "" when absent or not JSON. */
function scripts(text: string | undefined): string {
  if (text === undefined) return "";
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === "object" && v !== null && "scripts" in v ? JSON.stringify(v.scripts) : "";
  } catch {
    return "";
  }
}

/**
 * The range codes of k.escapes read from a range's changes to files in scope (R1060, R1061, R1103 to R1105, R1107,
 * R1108; R1100 is the caller's, from the whole range). `before` and `after` give a path's text at `<base>` and
 * `<head>`. Each finding is at line 1 of its head path (a deleted file's: its base path) and its text is its message.
 */
export function rangeEscapes(
  changes: readonly Change[],
  before: (path: string) => string | undefined,
  after: (path: string) => string | undefined,
): AtPath[] {
  const out: AtPath[] = [];
  for (const c of changes) {
    const name = baseName(c.path);
    const old = c.from === undefined ? undefined : before(c.from);
    const now = c.status === "D" ? undefined : after(c.path);
    if (/(?:^|\/)conformance\//.test(c.path) || (c.from !== undefined && /(?:^|\/)conformance\//.test(c.from)))
      out.push(at(c.path, "R1061", `a conformance file ${c.status === "D" ? "deleted" : "changed"}`));
    if (c.same === true) continue;
    if (CONFIG.test(name)) out.push(at(c.path, "R1103", `${name} changed`));
    if (name === "package.json" && scripts(old) !== scripts(now))
      out.push(at(c.path, "R1103", "package.json scripts changed"));
    if (/(?:^|\/)\.(?:github|githooks)\//.test(c.path)) out.push(at(c.path, "R1104", `${c.path} changed`));
    if (name === "keel-review.json") out.push(at(c.path, "R1105", "the review baseline changed"));
    if (/(?:^|\/)(?:\.keel|dist)\//.test(c.path)) out.push(at(c.path, "R1107", "a generated file changed"));
    if (TEST.test(c.path) && CODE.test(c.path)) {
      if (c.status === "D") out.push(at(c.path, "R1060", "a test file deleted"));
      else if (old !== undefined && now !== undefined) {
        const was = callCounts(c.from ?? c.path, old);
        const is = callCounts(c.path, now);
        if (was !== null && is !== null && is.tests < was.tests)
          out.push(at(c.path, "R1060", `test and assertion calls ${was.tests} to ${is.tests}`));
      }
    }
    if (CODE.test(c.path) && (c.status === "M" || c.status === "R") && old !== undefined && now !== undefined) {
      const was = callCounts(c.from ?? c.path, old);
      const is = callCounts(c.path, now);
      if (was !== null && is !== null)
        for (const [k, call] of KINDS)
          if (is[k] < was[k]) out.push(at(c.path, "R1108", `${call} calls ${was[k]} to ${is[k]}`));
    }
  }
  return out;
}
