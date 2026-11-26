import { clipMessage } from "@keel/schema/internal";
import { tokenGroups } from "@keel/ui/css";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { projectLooks } from "../internal/looks/projectLooks.ts";
import { str } from "../internal/str.ts";
import { tokenLiterals } from "../internal/tokenLiterals.ts";
import { tokenSetAt } from "../internal/tokenSetAt.ts";
import { tokenSetMisses } from "../internal/tokenSetMisses.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
const NO_TOKENS = ": the project has no tokens.ts";

/**
 * Whether the project of `file` has a `tokens.ts` at its root: a `tokens.ts` among the project's files in a folder
 * that holds `file` and is no module's (a library read in an app lies under `modules/`).
 */
const hasTokensFile = (file: SourceFile, project: readonly SourceFile[]): boolean =>
  project.some((f) => {
    const m = /^(.*\/)?tokens\.ts$/.exec(f.path);
    if (m === null) return false;
    const dir = m[1] ?? "";
    return file.path.startsWith(dir) && !dir.split("/").some((s) => s === "modules" || s === "node_modules");
  });

/**
 * E1801 (k.ui, k.a11y-static Token names). Over the tokens artifact: a token name or breakpoint in a `base` set or a
 * look that the tokens do not declare, at the project's `tokens.ts` (else its first file), but a name a listed library
 * ships (E1810 judges it, k.looks). In an app file that is no library's (`tokenLiterals`): a name its prop's groups
 * lack, a responsive key no `breakpoint` token names and a look `look` lacks are each one finding at the literal or
 * key; a library's file is E1811's. With no tokens artifact and no `tokens.ts` each such literal and key is one, its
 * message ending `: the project has no tokens.ts`; with a `tokens.ts` that gave no tokens (E1807) none is judged.
 */
export const unknownToken: RuleDef = {
  code: "E1801",
  message: (f) => {
    const kind = str(f.data, "kind");
    const value = clipMessage(str(f.data, "value"), 20);
    const tail = str(f.data, "none") === "" ? "" : NO_TOKENS;
    if (kind === "prop")
      return clipMessage(`${str(f.data, "prop")}="${value}" is not a ${str(f.data, "groups")} token${tail}`, 89);
    if (kind === "breakpoint") return clipMessage(`breakpoint "${value}" is not a breakpoint token${tail}`, 89);
    if (kind === "look") return clipMessage(`look="${value}" is not a look token${tail}`, 89);
    return clipMessage(`${str(f.data, "set")} ${str(f.data, "what")}`, 89);
  },
  see: "k.ui",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = isRec(artifacts.tokens) ? artifacts.tokens : undefined;
    const looks = projectLooks.get(project);
    const out: Finding[] = [];
    if (tokens !== undefined)
      for (const m of tokenSetMisses(tokens)) {
        if (looks?.ships(m.token) === true) continue;
        const at = tokenSetAt(file, project, m.set);
        if (at !== undefined) out.push(findingAt(file, at, { set: m.set, what: m.what }));
      }
    if (!isAppPath(file.path) || looks?.libraryOf(file.path) !== undefined) return out;
    if (tokens === undefined && hasTokensFile(file, project)) return out;
    const none = tokens === undefined ? { none: "1" } : {};
    const has = (group: string, name: string): boolean => {
      const g = tokens?.[group];
      return isRec(g) && Object.hasOwn(g, name);
    };
    for (const t of tokenLiterals(ast)) {
      if (t.kind === "prop") {
        const groups = tokenGroups[t.prop] ?? [];
        if (!groups.some((g) => has(g, t.value)))
          out.push(
            findingAt(file, t.at, { kind: "prop", prop: t.prop, value: t.value, groups: groups.join(" or "), ...none }),
          );
      } else if (t.kind === "breakpoint") {
        if (!has("breakpoint", t.value))
          out.push(findingAt(file, t.at, { kind: "breakpoint", value: t.value, ...none }));
      } else if (!has("look", t.value)) out.push(findingAt(file, t.at, { kind: "look", value: t.value, ...none }));
    }
    return out;
  },
};
