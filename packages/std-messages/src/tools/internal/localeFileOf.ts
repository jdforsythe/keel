import type { SourceFile } from "@keel/check";
import type { SetDecl } from "./SetDecl.ts";
import { parsed } from "./parsed.ts";
import { setDecls } from "./setDecls.ts";

const RE = /^((?:.*\/)?)([A-Za-z_$][\w$]*)\/([^/]+)\.ts$/;

/** For a locale file `<dir><Set>/<locale>.ts`, the set `<dir><Set>.schema.ts` declares; else `undefined`. */
export function localeFileOf(
  path: string,
  project: readonly SourceFile[],
): { readonly set: SetDecl; readonly locale: string } | undefined {
  const m = RE.exec(path);
  if (m === null) return undefined;
  const [, dir = "", name = "", locale = ""] = m;
  const schema = project.find((f) => f.path === `${dir}${name}.schema.ts`);
  const ast = schema === undefined ? undefined : parsed(schema);
  const set = ast === undefined ? undefined : setDecls(ast).find((d) => d.name === name);
  return set === undefined ? undefined : { set, locale };
}
