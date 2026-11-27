import { HOST_VIEWS } from "./HOST_VIEWS.ts";

/** Names a CommonJS module binds itself, never read from the global object. */
const OWN = new Set(["require", "module", "exports", "__filename", "__dirname"]);
const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * The esbuild `define` of a build-time evaluation bundle (k.compiler Build-time evaluation): every free name of a
 * property the global object holds in this process that `HOST_VIEWS` does not list as pure reads through the bundle's
 * global view (`__keelGlobal.<name>`), so a free `process`, `Function`, `fetch` or a global Node adds later is that
 * view's or refused; `globalThis` and `global` are the view itself.
 */
export function globalDefines(): Record<string, string> {
  const pure = new Set(HOST_VIEWS.globals.pure);
  const out: Record<string, string> = { globalThis: "__keelGlobal", global: "__keelGlobal" };
  for (const name of Object.getOwnPropertyNames(globalThis))
    if (IDENT.test(name) && !pure.has(name) && !OWN.has(name) && !(name in out)) out[name] = `__keelGlobal.${name}`;
  return out;
}
