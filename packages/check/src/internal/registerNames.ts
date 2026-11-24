import { clipMessage } from "@keel/schema/internal";
import { Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Checked } from "./Checked.ts";
import { diagAt } from "./diagAt.ts";
import { isAppPath } from "./isAppPath.ts";
import { lineCol } from "./lineCol.ts";
import { localNames } from "./modules/localNames.ts";
import { namespaceNames } from "./modules/namespaceNames.ts";

const LOWER_CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const MODULE_DIR = /^modules\/([^/]+)\//;

type Call = { readonly at: number; readonly name: string | undefined };

/** The `register` calls of `@keel/ctx` in a file, in source order: each with its literal name, or none. */
function registerCalls({ parsed }: Checked): Call[] {
  const direct = localNames(parsed.program, "register", "@keel/ctx");
  const spaces = namespaceNames(parsed.program, "@keel/ctx");
  if (direct.size === 0 && spaces.size === 0) return [];
  const out: Call[] = [];
  new Visitor({
    CallExpression: (n) => {
      const c = n.callee;
      const hit =
        (c.type === "Identifier" && direct.has(c.name)) ||
        (c.type === "MemberExpression" &&
          !c.computed &&
          c.property.name === "register" &&
          c.object.type === "Identifier" &&
          spaces.has(c.object.name));
      if (!hit) return;
      const a = n.arguments[0];
      out.push({ at: n.start, name: a?.type === "Literal" && typeof a.value === "string" ? a.value : undefined });
    },
  }).visit(parsed.program);
  return out.sort((x, y) => x.at - y.at);
}

/**
 * E1607 (k.data): a `register` of `@keel/ctx` in a file under `modules/<id>/` whose name is not a string literal
 * `<id>.<name>`, `<name>` one lowerCamel segment; or a name another app file of the project registers too, at the call
 * in the file whose path sorts later. `dirs` are the project roots (`projectDirs`), deepest first.
 */
export function registerNames(files: readonly Checked[], dirs: readonly string[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const first = new Map<string, { path: string; line: number }>();
  const ordered = [...files].sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));
  for (const checked of ordered) {
    const { file } = checked;
    if (!isAppPath(file.path)) continue;
    const dir = dirs.find((d) => file.path.startsWith(d)) ?? "";
    const id = MODULE_DIR.exec(file.path.slice(dir.length))?.[1];
    for (const call of registerCalls(checked)) {
      if (id !== undefined && !wellNamed(call.name, id)) {
        const shown =
          call.name === undefined ? "a name that is not a string literal" : `"${clipMessage(call.name, 30)}"`;
        out.push(
          diagAt(
            file,
            call.at,
            "E1607",
            `register of ${shown}: name it '${clipMessage(id, 20)}.<lowerCamel>'`,
            "k.data",
          ),
        );
        continue;
      }
      if (call.name === undefined) continue;
      const key = `${dir}\0${call.name}`;
      const prior = first.get(key);
      if (prior === undefined) {
        first.set(key, { path: file.path, line: lineCol(file.source, call.at).line });
        continue;
      }
      if (prior.path === file.path) continue;
      const message = `capability "${clipMessage(call.name, 30)}" also registered at ${prior.path.slice(-30)}:${prior.line}`;
      out.push(diagAt(file, call.at, "E1607", message, "k.data"));
    }
  }
  return out;
}

/** Whether `name` is `<id>.<name>` with `<name>` one lowerCamel segment. */
function wellNamed(name: string | undefined, id: string): boolean {
  if (name === undefined || !name.startsWith(`${id}.`)) return false;
  return LOWER_CAMEL.test(name.slice(id.length + 1));
}
