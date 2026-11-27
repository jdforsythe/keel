import { routeLiterals } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import type { ObjectExpression } from "oxc-parser";
import { clipMessage } from "@keel/schema/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { isRecord } from "./compat/isRecord.ts";
import { lineCol } from "./lineCol.ts";
import { moduleContracts } from "./moduleContracts.ts";
import { parseFile } from "./parseFile.ts";
import { propertyOf } from "./propertyOf.ts";

const CONTRACT = /\.contract\.ts$/;

/** `text` parsed as JSON; undefined when it is not JSON (E1005 reports that file). */
function parsed(text: string): unknown {
  try {
    const v: unknown = JSON.parse(text);
    return v;
  } catch {
    return undefined;
  }
}

/** Whether a contract entry literal's `local` member is the literal `true` (k.contract Local routes). */
const localLiteral = (obj: ObjectExpression | null): boolean => {
  const p = obj === null ? null : propertyOf(obj, "local");
  return p !== null && p.value.type === "Literal" && p.value.value === true;
};

/**
 * E1511 (k.api, k.topology): an API entry or a `local: true` entry (k.contract Local routes) in a module that a
 * `client` or `static` deployable of `topology` serves; those have no server to answer or enforce it. Such an entry is
 * one of an app module's contract (`modules/<m>/<m>.contract.ts`, k.contract) among `files` (paths relative to the
 * project `dir`), one `routeLiterals` reads as `api: true` or `local: true` (a placed stdlib module's among them), or
 * one with `api: true` or `local: true` in `evaluated`, the text of `<dir>.keel/routes.json` the build writes from the
 * evaluated contracts. One per entry, its message naming a `local` entry's as a local route, any other as an API
 * route. Reported at `<dir>topology.ts`, on the module id in `source` (its text) when found. Package routes resolve
 * from `root`. No fix.
 */
export function apiWithoutServer(
  dir: string,
  files: readonly SourceFile[],
  topology: Topology,
  root: string,
  source = "",
  evaluated = "",
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const ids = new Set<string>();
  const local = new Set<string>();
  const note = (id: string, api: boolean, isLocal: boolean): void => {
    if (api || isLocal) ids.add(id);
    if (isLocal) local.add(id);
  };
  const contracts = moduleContracts(
    files.filter((f) => CONTRACT.test(f.path)).map((file) => ({ file, parsed: parseFile(file) })),
  );
  for (const { dir: at, contract } of contracts)
    if (at === "") for (const e of contract.list) note(e.id, e.kind === "api", localLiteral(e.obj));
  for (const [id, r] of Object.entries(routeLiterals(files, { root })?.routes ?? {}))
    note(id, r.api === true, r.local === true);
  const data = evaluated === "" ? undefined : parsed(evaluated);
  if (isRecord(data))
    for (const [id, r] of Object.entries(data)) if (isRecord(r)) note(id, r.api === true, r.local === true);
  for (const [name, d] of Object.entries(topology))
    for (const id of [...ids].sort()) {
      const m = id.split(".")[0] ?? id;
      if (d.adapter === "node" || !d.modules.includes(m)) continue;
      const { line, col } = lineCol(source, Math.max(0, source.search(new RegExp(`["'\`]${m}["'\`]`))));
      const what = local.has(id) ? "local" : "API";
      const message = `${id}: ${what} route in ${d.adapter} deployable ${name}, which has no server`;
      out.push({
        kind: "diag",
        code: "E1511",
        path: `${dir}topology.ts`,
        line,
        col,
        message: clipMessage(message, 89),
        see: "k.api",
      });
    }
  return out;
}
