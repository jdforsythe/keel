import { findingAt } from "../internal/findingAt.ts";
import { hostCodeSpecifier } from "../internal/hostCodeSpecifier.ts";
import { hostUses } from "../internal/hostUses.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1824 (k.host-element): a `Host` from `@keel/ui` (JSX or a call) whose `code` is not
 * `() => import("<relative path>").then((m) => m.<export>)`, a literal specifier and one member of the module, or a
 * `Host` without `input` and no spread. One finding per prop or element. No fix: the import's path is the author's.
 */
export const hostCodeImport: RuleDef = {
  code: "E1824",
  message: (f) =>
    f.data?.why === "input"
      ? "<Host> has no input; give it the schema of its value"
      : '<Host> code must be () => import("./x.ts").then((m) => m.x)',
  see: "k.host-element",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || !file.source.includes("Host")) return [];
    const out: Finding[] = [];
    for (const use of hostUses(ast)) {
      const code = use.props.get("code");
      if (code !== undefined && hostCodeSpecifier(code.value) === null)
        out.push(findingAt(file, code.start, { why: "code" }));
      if (!use.spread && !use.props.has("input")) out.push(findingAt(file, use.start, { why: "input" }));
    }
    return out;
  },
};
