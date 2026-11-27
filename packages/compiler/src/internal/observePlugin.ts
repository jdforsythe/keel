import fs from "node:fs";
import type { Plugin } from "esbuild";

const NS = "keel-observe";
/** The Node modules whose imports in a build-time evaluation bundle go through a recording view. */
const OBSERVED = /^(?:node:)?(?:fs|fs\/promises|process)$/;
const IDENT = /^[A-Za-z_$][\w$]*$/;

/** What each wrapped function records of its first argument: a read file, or a probe of one kind. */
const FS_NOTES: Readonly<Record<string, string>> = {
  readFileSync: "read",
  readFile: "read",
  createReadStream: "read",
  openSync: "read",
  open: "read",
  existsSync: "exists",
  exists: "exists",
  statSync: "exists",
  stat: "exists",
  lstatSync: "exists",
  lstat: "exists",
  accessSync: "exists",
  access: "exists",
  realpathSync: "realpath",
  realpath: "realpath",
  readdirSync: "list",
  readdir: "list",
  opendirSync: "list",
  opendir: "list",
};
const PROMISE_NOTES: Readonly<Record<string, string>> = {
  readFile: "read",
  open: "read",
  stat: "exists",
  lstat: "exists",
  access: "exists",
  realpath: "realpath",
  readdir: "list",
  opendir: "list",
};

/** The shared head of a view module: the path a first argument names, and the wrapper that records it. */
const HEAD = [
  'import { resolve as keelResolve } from "node:path";',
  'import { fileURLToPath as keelFileUrl } from "node:url";',
  "const keelAt = (x) => {",
  "  if (typeof x === 'string') return keelResolve(x);",
  "  if (x instanceof URL) return x.protocol === 'file:' ? keelFileUrl(x) : undefined;",
  "  if (x instanceof Uint8Array) return keelResolve(Buffer.from(x).toString('utf8'));",
  "  return undefined;",
  "};",
  "const keelNote = (kind, x) => { const f = keelAt(x); if (f === undefined) return; if (kind === 'read') __keelObserved.reads.push(f); else __keelObserved.probes.push([kind, f]); };",
  "const keelWrap = (fn, kind) => {",
  "  if (typeof fn !== 'function') return fn;",
  "  const w = function (...a) { keelNote(kind, a[0]); return fn.apply(this, a); };",
  "  for (const k of Object.keys(fn)) w[k] = typeof fn[k] === 'function' ? keelWrap(fn[k], kind) : fn[k];",
  "  return w;",
  "};",
].join("\n");

/** `export const <k> = view.<k>;` for each name of `names` that is an identifier, and `view` as the default. */
const exportsOf = (names: readonly string[]): string =>
  [
    ...names.filter((k) => IDENT.test(k) && k !== "default").map((k) => `export const ${k} = keelView.${k};`),
    "export default keelView;",
  ].join("\n");

/** `{ ...real, <name>: keelWrap(real.<name>, <kind>) ... }` for the names `notes` gives. */
const viewOf = (real: string, notes: Readonly<Record<string, string>>): string =>
  `{ ...${real}, ${Object.entries(notes)
    .map(([k, kind]) => `${k}: keelWrap(${real}.${k}, ${JSON.stringify(kind)})`)
    .join(", ")} }`;

/** The source of the view module of `name` (`fs`, `fs/promises` or `process`). */
function viewSource(name: string): string {
  if (name === "process") return `const keelView = __keelProcess;\n${exportsOf(Object.keys(process))}`;
  const promises = viewOf("keelRealPromises", PROMISE_NOTES);
  if (name === "fs/promises")
    return [
      'import keelRealPromises from "node:fs/promises";',
      HEAD,
      `const keelView = ${promises};`,
      exportsOf(Object.keys(fs.promises)),
    ].join("\n");
  return [
    'import keelRealFs from "node:fs";',
    'import keelRealPromises from "node:fs/promises";',
    HEAD,
    `const keelView = { ...${viewOf("keelRealFs", FS_NOTES)}, promises: ${promises} };`,
    exportsOf(Object.keys(fs)),
  ].join("\n");
}

/**
 * The esbuild plugin of a build-time evaluation bundle that observes its reads (k.derived Derivation cache): each
 * import of `node:fs`, `node:fs/promises` or `node:process` (with or without `node:`), static or a literal `require`,
 * gets a view module of the bundle's own whose functions record their first argument in `__keelObserved`
 * (`OBSERVE_BANNER`) and then call the real ones; the views import the real modules. Reads not seen: a computed
 * `require`, a file descriptor's path, a native addon's or a child process's reads, and `globalThis.process.env`.
 */
export function observePlugin(): Plugin {
  return {
    name: "keel-observe",
    setup(b) {
      b.onResolve({ filter: OBSERVED }, (args) =>
        args.namespace === NS
          ? { path: args.path.startsWith("node:") ? args.path : `node:${args.path}`, external: true }
          : { path: args.path.replace(/^node:/, ""), namespace: NS },
      );
      b.onLoad({ filter: /.*/, namespace: NS }, (args) => ({
        contents: viewSource(args.path),
        loader: "js",
        resolveDir: process.cwd(),
      }));
    },
  };
}
