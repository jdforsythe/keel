import { HOST_BANNER } from "./HOST_BANNER.ts";
import { HOST_VIEWS } from "./HOST_VIEWS.ts";
import { RESOLVE_BANNER } from "./RESOLVE_BANNER.ts";
import { SERVER_ENV } from "./SERVER_ENV.ts";
import { UNRESOLVED_MARK } from "./UNRESOLVED_MARK.ts";

/**
 * The head of a build-time evaluation bundle (k.derived Derivation cache, k.compiler Build-time evaluation):
 * `__keelObserved`, the record of what the bundle's code asks (`Observed`; the process's working folder, Node's
 * version and the default locale and time zone always among its probes), `__keelHost`, the allowlist `HOST_VIEWS`, and
 * the bundle's own views of what it reaches (`HOST_BANNER`): `__keelGlobal`, which every free `globalThis` and
 * `global` names and every free name of a global that is not pure reads through, `__keelProcess`, `__keelBuiltin(id)`
 * for each Node built-in, `node:fs` and `node:fs/promises` recording each read, open, existence test, stat (with each
 * field of the result the code reads), real path and listing. Besides them:
 * - `__keelRequireFor(base)`, `node:module`'s `createRequire`: a `require` whose names resolve from `base`'s folder
 *   through the bundle's own resolver (`RESOLVE_BANNER`): a Node built-in through these views, a `.json` file a
 *   recorded read, an absent one Node's not-found error with its questions recorded, any other file refused; `resolve`
 *   the same lookup, and `cache`, `extensions` and `main` its own, empty. The bundle's free `require`, which a computed
 *   `import()` becomes, knows no file: it takes a built-in, an absolute path, or a name the bundle left unresolved
 *   (`__keelUnresolved`, whose questions `pathLinks` recorded at the importer), and refuses any other name.
 * - `__keelMetaFor(url)`: a module's `import.meta`, its own `url`, `filename` and `dirname`, `resolve` refused.
 * All are the bundle's own bindings: nothing global changes, so another evaluation in the process sees its own record
 * only.
 */
export const OBSERVE_BANNER = [
  'import __keelFsReal from "node:fs";',
  'import __keelFsPromisesReal from "node:fs/promises";',
  'import { createRequire as __keelCreateRequire, isBuiltin as __keelIsBuiltin } from "node:module";',
  'import __keelPathReal from "node:path";',
  'import { fileURLToPath as __keelFileUrl } from "node:url";',
  "const __keelPathResolve = __keelPathReal.resolve;",
  "const __keelObserved = { reads: [], probes: [['process', 'cwd'], ['process', 'version'], ['process', 'Intl.locale'], ['process', 'Intl.timeZone']], env: [], envListed: false };",
  `const __keelUnresolved = new Set(${UNRESOLVED_MARK});`,
  `const __keelHost = ${JSON.stringify(HOST_VIEWS)};`,
  HOST_BANNER,
  RESOLVE_BANNER,
  "const __keelNotFound = (id) => { const e = new Error(`Cannot find module '${id}'`); e.code = 'MODULE_NOT_FOUND'; throw e; };",
  "const __keelJson = new Map();",
  "const __keelRequireFor = (base) => {",
  "  const b = base instanceof URL || (typeof base === 'string' && base.startsWith('file:')) ? __keelFileUrl(base) : base === undefined ? undefined : String(base);",
  "  const from = b === undefined ? undefined : b.endsWith('/') ? b : __keelPathReal.dirname(b);",
  "  const file = (id) => {",
  "    if (from === undefined) {",
  "      if (__keelUnresolved.has(id)) __keelNotFound(id);",
  "      if (!__keelPathReal.isAbsolute(id)) __keelRefuse(`a require or import() of ${JSON.stringify(id)}, a name built at run time outside createRequire,`);",
  "    }",
  "    return __keelResolve(id, from ?? '/') ?? __keelNotFound(id);",
  "  };",
  "  const req = function require(id) {",
  "    if (typeof id === 'string' && __keelIsBuiltin(id)) return __keelBuiltin(id);",
  "    const f = file(String(id));",
  "    if (!f.endsWith('.json')) __keelRefuse(`a require or import() of ${JSON.stringify(String(id))}, a code file named at run time,`);",
  "    if (!__keelJson.has(f)) { __keelObserved.reads.push(f); __keelJson.set(f, JSON.parse(__keelFsReal.readFileSync(f, 'utf8'))); }",
  "    return __keelJson.get(f);",
  "  };",
  "  const resolve = function resolve(id) { return typeof id === 'string' && __keelIsBuiltin(id) ? id : file(String(id)); };",
  "  return Object.assign(req, { resolve, cache: Object.create(null), extensions: Object.create(null), main: undefined });",
  "};",
  `const __keelServerEnv = ${JSON.stringify(SERVER_ENV)};`,
  "const __keelMetaFor = (url) => { const filename = __keelFileUrl(url); return { url, filename, dirname: __keelPathReal.dirname(filename), main: false, env: __keelServerEnv, resolve: __keelRefusedFn('import.meta.resolve') }; };",
  "const require = __keelRequireFor(undefined);",
].join("\n");
