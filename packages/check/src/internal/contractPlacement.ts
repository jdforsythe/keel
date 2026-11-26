import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Checked } from "./Checked.ts";
import type { LibraryContract } from "./LibraryView.ts";
import { bindingCalls } from "./bindingCalls.ts";
import { contractCalls } from "./contractCalls.ts";
import { contractEscapes } from "./contractEscapes.ts";
import { diagAt } from "./diagAt.ts";
import { isAppPath } from "./isAppPath.ts";
import { joinPath } from "./modules/joinPath.ts";

const IN_MODULE = /^((?:.*\/)?)modules\/([^/]+)\//;
const CONTRACT = /^(?:.*\/)?modules\/([^/]+)\/([^/]+)\.contract\.ts$/;
const NAME = /^[a-z][A-Za-z0-9]*$/;
const SEE = "k.contract";
const clip = (x: string): string => (x.length > 28 ? `${x.slice(0, 25)}...` : x);

/** Where a library's contract belongs, for E1513's messages: its `./contract` file package-relative, else why none. */
function libraryHome(lib: LibraryContract, folder: string): string {
  if (lib.file !== undefined) return lib.file.slice(folder.length);
  if (lib.target === undefined) return "the file a ./contract export names";
  return `a src/*.contract.ts file, not ${clip(lib.target)}`;
}

/** The module folder `path` lies in (`dir` the project directory above `modules/`), or `null`. */
function moduleOf(path: string): { readonly dir: string; readonly id: string } | null {
  const m = IN_MODULE.exec(path);
  return m === null ? null : { dir: m[1] ?? "", id: m[2] ?? "" };
}

/**
 * E1513 (k.contract Rules) over app code, no fix, each message naming the expected contract path: a `contract()`
 * call outside `modules/<id>/<id>.contract.ts`, a second call in that file, an `id` not the folder's module id, an
 * export not named `<id>`, an API id whose name after the module is not one lowerCamel segment, and a module's
 * `routes.ts` binding a contract imported from another module's contract file, and `contract` reached other than by a
 * direct call of its import (`contractEscapes`: an alias, a value use, a re-export, a dynamic import), which no
 * contract reader follows. A library's file (`libraries`: its view folder to its `./contract` entry) holds its
 * module's contract in the file its `./contract` export names alone, when that is a `src/` `*.contract.ts` file, the
 * expected path written package-relative (`src/health.contract.ts`); with no such entry, or one naming any other file
 * (`dist/health.contract.js`, `src/index.ts`, an `unsafe/` file), every call there is out of place.
 */
export function contractPlacement(
  files: readonly Checked[],
  libraries: ReadonlyMap<string, LibraryContract> = new Map(),
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const { file, parsed } of files) {
    if (!isAppPath(file.path)) continue;
    const mod = moduleOf(file.path);
    const lib = mod === null ? undefined : libraries.get(`${mod.dir}modules/${mod.id}/`);
    const own = CONTRACT.exec(file.path);
    const home = lib === undefined ? own !== null && own[1] === own[2] : file.path === lib.file;
    const libHome = lib === undefined || mod === null ? undefined : libraryHome(lib, `${mod.dir}modules/${mod.id}/`);
    const where = libHome ?? `${mod?.dir ?? ""}modules/${mod?.id ?? "<id>"}/${mod?.id ?? "<id>"}.contract.ts`;
    for (const n of contractEscapes(parsed.program))
      out.push(diagAt(file, n, "E1513", `call contract() directly by its import, in ${where}`, SEE));
    contractCalls(file, parsed.program).forEach((c, i) => {
      const id = mod?.id ?? c.id ?? "<id>";
      const expected = libHome ?? `${mod?.dir ?? ""}modules/${id}/${id}.contract.ts`;
      const at = (n: number, message: string): void => {
        out.push(diagAt(file, n, "E1513", message, SEE));
      };
      if (!home) at(c.call.start, `contract() belongs in ${expected}`);
      else if (i > 0) at(c.call.start, `a second contract() call; ${expected} holds one`);
      else if (c.id !== id) at(c.call.start, `contract id must be '${id}', the module of ${expected}`);
      else if (c.exported !== id) at(c.call.start, `export the contract as \`${id}\` from ${expected}`);
      const module = c.id ?? id;
      for (const e of c.list) {
        if (e.kind !== "api" || !e.id.startsWith(`${module}.`) || NAME.test(e.id.slice(module.length + 1))) continue;
        at(e.prop.key.start, `${e.id}: an API id is ${module}.<name>, one lowerCamel segment (${expected})`);
      }
    });
    if (mod === null || !file.path.endsWith(`modules/${mod.id}/routes.ts`)) continue;
    const expected = `${mod.dir}modules/${mod.id}/${mod.id}.contract.ts`;
    for (const b of bindingCalls(file, parsed.program)) {
      if (b.source === null || !b.source.startsWith(".")) continue;
      const target = CONTRACT.exec(joinPath(file.path.slice(0, file.path.lastIndexOf("/")), b.source));
      const first = b.call.arguments[0];
      if (target === null || target[1] === mod.id || first === undefined) continue;
      out.push(diagAt(file, first.start, "E1513", `routes.ts binds ${target[1]}'s contract; bind ${expected}`, SEE));
    }
  }
  return out;
}
