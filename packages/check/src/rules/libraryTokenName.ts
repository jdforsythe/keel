import { clipMessage } from "@keel/schema/internal";
import { tokenGroups } from "@keel/ui/css";
import { findingAt } from "../internal/findingAt.ts";
import { projectLooks } from "../internal/looks/projectLooks.ts";
import { str } from "../internal/str.ts";
import { tokenLiterals } from "../internal/tokenLiterals.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1811 (k.looks Needs): in a library's file, a token name written as a string literal (`tokenLiterals`) that its
 * shipped object does not hold, in the prop's groups, as a `breakpoint` or as a `look`, at the literal or key. With no
 * `./tokens` entry every such literal is one, its message ending `: <name> ships no ./tokens entry`. A shipped file
 * that cannot be read (E1812's `keel` target, or not parsed) judges none. Read as text: no tokens artifact is needed.
 */
export const libraryTokenName: RuleDef = {
  code: "E1811",
  message: (f) => {
    const value = clipMessage(str(f.data, "value"), 20);
    const kind = str(f.data, "kind");
    const head =
      kind === "prop"
        ? `${str(f.data, "prop")}="${value}"`
        : kind === "look"
          ? `look="${value}"`
          : `breakpoint "${value}"`;
    const none = str(f.data, "none");
    return clipMessage(
      none === "" ? `${head} is not in ${str(f.data, "id")}Tokens` : `${head}: ${none} ships no ./tokens entry`,
      89,
    );
  },
  see: "k.looks",
  check: ({ file, ast, project }) => {
    const lib = projectLooks.get(project)?.libraryOf(file.path);
    if (lib === undefined || lib.entry === "wrong" || (lib.entry === "ok" && lib.shipped === null)) return [];
    const names = lib.entry === "ok" ? lib.shipped?.names : undefined;
    const holds = (group: string, name: string): boolean => names?.get(group)?.includes(name) === true;
    const tail = names === undefined ? { none: lib.name } : { id: lib.id };
    const out: Finding[] = [];
    for (const t of tokenLiterals(ast)) {
      const ok =
        t.kind === "prop"
          ? (tokenGroups[t.prop] ?? []).some((g) => holds(g, t.value))
          : holds(t.kind === "look" ? "look" : "breakpoint", t.value);
      if (!ok)
        out.push(
          findingAt(file, t.at, { kind: t.kind, value: t.value, prop: t.kind === "prop" ? t.prop : "", ...tail }),
        );
    }
    return out;
  },
};
