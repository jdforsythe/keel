import { FS_BANNER } from "./FS_BANNER.ts";
import { HOST_BANNER } from "./HOST_BANNER.ts";
import { HOST_VIEWS } from "./HOST_VIEWS.ts";
import { RESOLVE_BANNER } from "./RESOLVE_BANNER.ts";
import { SERVER_ENV } from "./SERVER_ENV.ts";
import { UNRESOLVED_MARK } from "./UNRESOLVED_MARK.ts";

/**
 * The head of a build-time evaluation bundle (k.evaluator Realm, k.compiler Build-time evaluation), run in an
 * evaluator before the bundle's first module: `__keelHost`, the allowlist `HOST_VIEWS`, the views of what the code
 * reaches (`HOST_BANNER`, `FS_BANNER`), each asking the command, which records the question, and the bundle's own
 * resolver (`RESOLVE_BANNER`). Besides them:
 * - `__keelRequireFor(base)`, `node:module`'s `createRequire`: a `require` whose names resolve from `base`'s folder
 *   through the bundle's own resolver: a Node built-in through these views, a `.json` file a read the command
 *   records, an absent one Node's not-found error with its questions recorded, any other file refused; `resolve`
 *   the same lookup, and `cache`, `extensions` and `main` its own, empty. The bundle's free `require`, which a computed
 *   `import()` becomes, knows no file: it takes a built-in, an absolute path, or a name the bundle left unresolved
 *   (`__keelUnresolved`, whose questions `pathLinks` recorded at the importer), and refuses any other name.
 * - `__keelMetaFor(url)`: a module's `import.meta`, its own `url`, `filename` and `dirname`, `resolve` refused.
 * Its last statement prepares the evaluator's global object (`__keelPrepare`), so the bundle's code meets only views.
 */
export const OBSERVE_BANNER = [
  'import { createRequire as __keelCreateRequire, isBuiltin as __keelIsBuiltin } from "node:module";',
  'import __keelPathReal from "node:path";',
  'import { fileURLToPath as __keelFileUrl } from "node:url";',
  `const __keelUnresolved = new Set(${UNRESOLVED_MARK});`,
  `const __keelHost = ${JSON.stringify(HOST_VIEWS)};`,
  HOST_BANNER,
  FS_BANNER,
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
  "    if (!__keelJson.has(f)) __keelJson.set(f, JSON.parse(__keelReadText(f)));",
  "    return __keelJson.get(f);",
  "  };",
  "  const resolve = function resolve(id) { return typeof id === 'string' && __keelIsBuiltin(id) ? id : file(String(id)); };",
  "  return Object.assign(req, { resolve, cache: Object.create(null), extensions: Object.create(null), main: undefined });",
  "};",
  `const __keelServerEnv = ${JSON.stringify(SERVER_ENV)};`,
  "const __keelMetaFor = (url) => { const filename = __keelFileUrl(url); return { url, filename, dirname: __keelPathReal.dirname(filename), main: false, env: __keelServerEnv, resolve: __keelRefusedFn('import.meta.resolve') }; };",
  "const require = __keelRequireFor(undefined);",
  "__keelPrepare();",
].join("\n");
