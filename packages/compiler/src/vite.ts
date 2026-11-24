import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { type Program, parseSync } from "oxc-parser";
import { compile } from "./compile.ts";
import { CLIENT_MANIFEST } from "./entry/CLIENT_MANIFEST.ts";
import { DEV_ENTRY } from "./entry/DEV_ENTRY.ts";
import { ENTRY_PATH } from "./entry/ENTRY_PATH.ts";
import { ISLANDS_PATH } from "./entry/ISLANDS_PATH.ts";
import { SERVER_ENTRY } from "./entry/SERVER_ENTRY.ts";
import { STYLES_PATH } from "./entry/STYLES_PATH.ts";
import { entryDependency } from "./entry/entryDependency.ts";
import { resumeEntry } from "./entry/resumeEntry.ts";
import { originOf } from "./hosting/originOf.ts";
import { peerOrigins } from "./hosting/peerOrigins.ts";
import { shellConnect } from "./hosting/shellConnect.ts";
import { topologyReadProblems } from "./hosting/topologyReadProblems.ts";
import { SERVER_ONLY_NAME } from "./internal/SERVER_ONLY_NAME.ts";
import { STUB_NAME } from "./internal/STUB_NAME.ts";
import { artifactText } from "./internal/artifactText.ts";
import { browserBreach } from "./internal/browserBreach.ts";
import { calledModules } from "./internal/calledModules.ts";
import { canonicalJson } from "./internal/canonicalJson.ts";
import { copyPgliteFiles } from "./internal/copyPgliteFiles.ts";
import { devEntryCode } from "./internal/devEntryCode.ts";
import { devMiddleware } from "./internal/devMiddleware.ts";
import { entryCode } from "./internal/entryCode.ts";
import { evaluateProject } from "./internal/evaluateProject.ts";
import { exportNames } from "./internal/exportNames.ts";
import { hostClient } from "./internal/hostClient.ts";
import { indexHtml } from "./internal/indexHtml.ts";
import { inspectMiddleware } from "./internal/inspectMiddleware.ts";
import { isNodeBuiltin } from "./internal/isNodeBuiltin.ts";
import { isSourcePath } from "./internal/isSourcePath.ts";
import { islandsCode } from "./internal/islandsCode.ts";
import { keelMark } from "./internal/keelMark.ts";
import { listSources } from "./internal/listSources.ts";
import { mergeArtifacts } from "./internal/mergeArtifacts.ts";
import { noDeployable } from "./internal/noDeployable.ts";
import { packageRoot } from "./internal/packageRoot.ts";
import { pageMiddleware } from "./internal/pageMiddleware.ts";
import { parseTopology } from "./internal/parseTopology.ts";
import { projectHandlerUses } from "./internal/projectHandlerUses.ts";
import { projectManifests } from "./internal/projectManifests.ts";
import { registeredIn } from "./internal/registeredIn.ts";
import { registersCapability } from "./internal/registersCapability.ts";
import { serverEntryCode } from "./internal/serverEntryCode.ts";
import { shortPath } from "./internal/shortPath.ts";
import { stubCode } from "./internal/stubCode.ts";
import { stylesMiddleware } from "./internal/stylesMiddleware.ts";
import { unmappedModule } from "./internal/unmappedModule.ts";
import { urlLiterals } from "./internal/urlLiterals.ts";
import { writeArtifact } from "./internal/writeArtifact.ts";
import { writeStatic } from "./internal/writeStatic.ts";
import { clientStdData } from "./std/clientStdData.ts";
import { importDeps } from "./std/importDeps.ts";
import { stdRoutes } from "./std/stdRoutes.ts";
import { stdArtifact } from "./stdArtifact.ts";
import type { Artifacts } from "./types/Artifacts.ts";
import type { Output } from "./types/Output.ts";
import type { RouteEntry } from "./types/RouteEntry.ts";
import type { Topology } from "./types/Topology.ts";

const CODE = /\.[cm]?[jt]sx?$/;
/** Test code and tool configs are not app code: no rules, no lowering (k.testing lint E1701 covers tests). */
const NOT_APP =
  /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)vitest(?:\.[\w-]+)?\.config\.[cm]?[jt]s$/;
const NAMES: readonly (keyof Artifacts)[] = ["a11y.json", "deps.json", "ids.json", "routes.json", "styles.json"];
/** What app code (the generated entry) imports for the atomic CSS, and the id it resolves to. */
/**
 * The shell a `keel build --target` build makes (`KEEL_SHELL`) and its `KEEL_ORIGIN` (unset or empty: no `origin`,
 * k.shell Without a server), else none (k.shell Build); with the deployable `name` of `topology`, its `id` there
 * (k.shell: a shell build always has it, with or without `identity.ts`) and its `connect` origins (`shellConnect`).
 */
const shellOf = (
  topology: Topology = {},
  name = "",
): { kind: "capacitor" | "tauri"; origin?: string; id: string | undefined; connect: readonly string[] } | undefined => {
  const kind = process.env.KEEL_SHELL;
  const given = process.env.KEEL_ORIGIN;
  if (kind !== "capacitor" && kind !== "tauri") return undefined;
  const id = topology[name]?.shells?.[kind]?.id;
  if (given === undefined || given === "") return { kind, id, connect: shellConnect(topology, name, process.env) };
  const connect = shellConnect(topology, name, process.env, originOf(given) ?? given);
  return { kind, origin: given, id, connect };
};
const CSS_IMPORT = "virtual:keel.css";
/** The ESM bundle of a `'postgres'` entry gives `pg`'s CommonJS `require` of node built-ins a real `require`. */
const PG_BANNER =
  "import { createRequire as keelCreateRequire } from 'node:module'; const require = keelCreateRequire(import.meta.url);";
/** A build's failure on evaluation problems: one `keel: <code> ...` line each, as the plugin's warnings read. */
const evaluationFailed = (problems: readonly string[]): Error =>
  new Error(problems.map((p) => `keel: ${p}`).join("\n"));

/** The served modules' `modules/<id>/migrations/` folders of `root`, copied under `out` at the same path (k.data Files). */
function copyMigrations(root: string, out: string, modules: readonly string[]): void {
  for (const id of modules) {
    const from = path.join(root, "modules", id, "migrations");
    if (fs.existsSync(from)) fs.cpSync(from, path.join(out, "modules", id, "migrations"), { recursive: true });
  }
}

/** The folder of the PGlite package `@keel/std-postgres` resolves from the project at `at`, if it resolves. */
function pgliteDist(at: string): string | undefined {
  try {
    const server = createRequire(path.join(at, "package.json")).resolve("@keel/std-postgres/server");
    return path.dirname(createRequire(server).resolve("@electric-sql/pglite"));
  } catch {
    return undefined;
  }
}
/**
 * `node:sqlite` in a build: read when the driver first runs, not linked at load, so `server.mjs` starts on a Node
 * without it and `start` reports the version (k.deploy Rules E1560).
 */
const SQLITE = "\0keel:sqlite";
/** A module Vite bundles as a worker of its own (`?worker`, `?sharedworker`; k.bundle Bundles). */
const WORKER_QUERY = /[?&](?:shared)?worker(?:&|$)/;
/**
 * `KEEL_*` variables whose values a browser build may hold (k.bundle Environment): the public origins, and the names
 * the build itself writes (the deployable, the shell kind).
 */
const PUBLIC_ENV = /^KEEL_(?:PEER_\w+|ORIGIN|DEPLOYABLE|SHELL|INSPECT_ORIGINS)$/;
/** No environment variable carries this prefix, so a browser build's `import.meta.env` exposes none (k.bundle). */
const NO_ENV = "\0";
const SQLITE_CODE = 'export const { DatabaseSync } = process.getBuiltinModule("node:sqlite");';
const CSS_ID = "/__keel.css";
/** Files whose change can alter the CSS or `routes.json` beyond one module's own usages. */
const PROJECT_FILE = /(?:^|\/)(?:tokens|topology|routes)\.ts$|\.schema\.ts$/;
/** App module manifests: their `std` entries are `std.json`. */
const MANIFEST = /^modules\/[^/]+\/module\.[cm]?[jt]s$/;

type Entry = {
  source: string;
  looks: string;
  output: Output | undefined;
  artifacts: Artifacts;
  failures: string[];
};
type ModuleNode = object;
type Middlewares = { use(fn: ReturnType<typeof inspectMiddleware> | ReturnType<typeof pageMiddleware>): void };
type DevServer = {
  transformIndexHtml?(url: string, html: string): Promise<string>;
  pluginContainer?: { resolveId(id: string, importer?: string): Promise<{ id: string } | null> };
  transformRequest?(url: string): Promise<{ code: string } | null>;
  config?: { server: { fs: { allow: string[] } } };
  moduleGraph: {
    getModuleById(id: string): ModuleNode | undefined;
    invalidateModule?(module: ModuleNode): void;
    invalidateAll?(): void;
  };
  reloadModule(module: ModuleNode): Promise<void>;
  ssrLoadModule?(id: string): Promise<Record<string, unknown>>;
  middlewares: Middlewares;
};
type DevApp = {
  readonly name: string;
  readonly app: { fetch(req: Request): Promise<Response>; close(): Promise<void> };
  served(path: string): boolean;
  readonly mount: string | undefined;
};
const isDevApp = (v: unknown): v is [string, DevApp["app"], DevApp["served"], DevApp["mount"]] =>
  Array.isArray(v) &&
  typeof v[0] === "string" &&
  typeof v[2] === "function" &&
  (v[3] === undefined || typeof v[3] === "string") &&
  typeof v[1] === "object" &&
  v[1] !== null &&
  typeof Reflect.get(v[1], "fetch") === "function" &&
  typeof Reflect.get(v[1], "close") === "function";
type Warn = (message: string) => void;
type BuildConfig = {
  build: {
    outDir: string;
    emptyOutDir: true;
    manifest: string;
    rolldownOptions: { input: Record<string, string> };
  };
  environments: {
    ssr: {
      resolve: { noExternal: true };
      build: {
        outDir: string;
        emptyOutDir: false;
        manifest: false;
        copyPublicDir: false;
        rolldownOptions: { input: string; output: { entryFileNames: string; codeSplitting: false } };
      };
    };
  };
  builder: { buildApp: (builder: Builder) => Promise<void> };
};
/** A `client` deployable's build: the project's own Vite config, written to `dist/<name>/`. */
type ClientConfig = { build: { outDir: string; emptyOutDir: true } };
type HtmlTag = { tag: "meta"; attrs: Record<string, string>; injectTo: "head" };
type Builder = { environments: Record<string, unknown>; build(environment: unknown): Promise<unknown> };
type ModuleInfo = {
  isEntry: boolean;
  importedIds: readonly string[];
  dynamicallyImportedIds: readonly string[];
  importers?: readonly string[];
  dynamicImporters?: readonly string[];
};
/** An emitted file of a bundle: a chunk's code or an asset's source. */
type Emitted = { fileName: string; code?: string; source?: string | Uint8Array };
/** The plugin context the browser-build hooks read: which environment runs, resolution, and the module graph. */
type Ctx =
  | {
      environment?: { config: { consumer: string; build?: { outDir: string } } };
      getModuleIds?: () => Iterable<string>;
      getModuleInfo?: (id: string) => ModuleInfo | null;
    }
  | undefined;
type HookOptions = { ssr?: boolean | undefined } | undefined;
/** A plugin Vite runs in each worker's bundle (k.bundle Bundles): the stubs, built-ins and the graph E1007 walks. */
type WorkerPlugin = {
  name: string;
  enforce: "pre";
  resolveId: (id: string, importer?: string) => { id: string; external: true } | null;
  load: (id: string) => string | null;
  transform: (code: string, id: string) => null;
  buildEnd: (this: Ctx, error?: Error) => void;
};
/** What `config` returns: the locked `envPrefix`, the worker bundles' plugin (Vite adds the project's), and a deployable build's own settings. */
type Config = { envPrefix: string; define?: Record<string, string>; worker: { plugins: () => WorkerPlugin[] } } & (
  | BuildConfig
  | ClientConfig
  | Record<never, never>
);
/** What the plugin reads of the project's config before Vite resolves it. */
type UserConfig = { root?: string; envPrefix?: unknown; define?: unknown };

/**
 * The Keel Vite plugin (k.compiler): no options. Each transform compiles only the changed module
 * (cached by source text), fails the module on diagnostics, and merges its artifacts with those of the
 * other modules seen so far. `.keel/<name>` (`{ data, hash }`, sorted keys, read-only) is rewritten
 * atomically (temp file + rename) and only when its content changed. Deleted modules are evicted.
 *
 * Project inputs: `buildStart` compiles every app source once (style usages for the CSS), reads
 * `topology.ts` statically (E1004 exemption for `client` deployables), and evaluates `tokens.ts` and the
 * deployable's modules' routes (an app module's `modules/<id>/routes.ts`, a stdlib module's package `./routes`)
 * to produce `keel.css` (`import "virtual:keel.css"`) and `routes.json`.
 * A `@keel/` specifier, subpaths included, a generated module imports (the client and islands entries, the server and
 * dev entries) that the project does not resolve resolves from the compiler's own dependencies (`entryDependency`).
 * It serves the generated entry at `/@keel/entry.ts` for the deployable `KEEL_DEPLOYABLE` names, else the first
 * `client` one by name: the `mount` entry for a `client` deployable (binding the client-readable part of `std.json`,
 * `clientStdData`, reloaded when a manifest changes), else the resume entry, whose island components
 * `/@keel/islands.ts` lists from the deployable's `routes.ts` files. `/@keel/entry.ts?d=<name>` and
 * `/@keel/islands.ts?d=<name>` are those of deployable `name`: for a `node` one, the resume entry over its own islands,
 * which its dev documents script (k.server Build). A `vite build` whose `KEEL_DEPLOYABLE`
 * is a `node` deployable builds that entry alone (input `entry`) into `dist/<name>/` with hashed `assets/` and the
 * manifest `CLIENT_MANIFEST` (k.server Build), then its generated production entry (`SERVER_ENTRY`,
 * `serverEntryCode`) with every dependency into `dist/<name>/server.mjs` beside `routes.json`, every module's routes
 * (`projectManifests` over every placed module, evaluated), and a copy of `.keel/std.json` (k.topology Build), and writes no `.keel/` artifacts (the project's own build does); any other build keeps the project's own Vite config. `buildStart` also imports the stdlib packages in the app
 * manifests' `deps` and writes `std.json` (`stdArtifact`); there a bad dep (E1159) or `std` entry (E1158) fails a build
 * and warns in dev, as does a changed manifest, whose new deps load before `std.json` is rewritten.
 *
 * With a `node` deployable, the dev server is `keel dev`'s one origin (k.topology Local topology): a request a `node`
 * deployable's route matches is answered by that deployable's dev app (`DEV_ENTRY`, `devMiddleware`), anything else by
 * Vite; a changed app source closes the dev apps and the next request loads them again, after they have closed.
 *
 * Dev and preview servers serve `/__keel/inspect` (k.cli Inspect): the `.keel/` artifacts plus the live graph and
 * stores the open page's dev entry last posted, to the server's own origin and those `KEEL_INSPECT_ORIGINS` lists.
 */
export default function (): {
  name: string;
  enforce: "pre";
  config: (user: UserConfig, env: { command: "build" | "serve"; isSsrBuild?: boolean }) => Config;
  configResolved: (config: {
    root: string;
    command?: "build" | "serve";
    configFile?: string | undefined;
    envPrefix?: string | readonly string[];
  }) => void;
  configureServer: (server: DevServer) => void;
  configurePreviewServer: (server: { middlewares: Middlewares }) => void;
  buildStart: (this: { warn?: Warn } | undefined) => Promise<void>;
  resolveId: (id: string, importer?: string, options?: HookOptions) => string | { id: string; external: true } | null;
  load: (id: string, options?: HookOptions) => Promise<string | null>;
  transformIndexHtml: () => HtmlTag[];
  buildEnd: (this: Ctx, error?: Error) => void;
  renderStart: () => void;
  generateBundle: { order: "post"; handler: (this: Ctx, options: unknown, bundle: Record<string, Emitted>) => void };
  closeBundle: () => void;
  transform: (code: string, id: string, options?: HookOptions) => { code: string; map: null } | null;
  watchChange: (id: string, change: { event: "create" | "update" | "delete" }) => void;
} {
  let root = process.cwd();
  /** Whether `configResolved` set `root`; until then no artifact is written. */
  let resolved = false;
  let command: "build" | "serve" | undefined;
  let server: DevServer | undefined;
  let topology: Topology | undefined;
  let routes: Record<string, RouteEntry> = {};
  let css = "";
  /** The tokens' `look` sets, once evaluated: `compile` lowers a `look` to their classes. */
  let looks: Readonly<Record<string, unknown>> | undefined;
  let looksKey = "";
  let stale = true;
  let usageKeys = "";
  let warn: Warn = () => {};
  /** The latest evaluation's problems: each fails a build at its end (k.compiler Build-time evaluation). */
  let problems: readonly string[] = [];
  /** A node deployable's client build (`config`) leaves `.keel/` to the project's own build: no artifact writes. */
  let clientBuild = false;
  /** The `client` deployable a `vite build` with `KEEL_DEPLOYABLE` naming one writes to `dist/<name>/` (k.hosting). */
  let hosting: string | undefined;
  /** The app modules the client entry's service map names, and the client's own; unset until the entry loads. */
  let mapped: ReadonlySet<string> | undefined;
  const modules = new Map<string, Entry>();
  /**
   * Browser builds (k.boundary, k.bundle): the server-only files loaded as stubs; the modules using a handler (read by
   * `projectHandlerUses` over `programs`, the parsed browser modules of every bundle); each worker bundle's graph; and
   * the files a module names by `new URL(<literal>, import.meta.url)`, which E1007 walks as imports.
   */
  const stubbed = new Set<string>();
  /** The server-only files dev gave the browser as stubs; the dev server's runner still compiles each file itself. */
  const devStubbed = new Set<string>();
  const handlers = new Set<string>();
  const programs = new Map<string, Program>();
  const workerGraph = new Map<string, { importedIds: Set<string>; dynamicallyImportedIds: Set<string> }>();
  const urlEdges = new Map<string, Set<string>>();
  /** Whether the project's own config sets `envPrefix` or `define` (k.bundle Environment), and whether this is an SSR build. */
  let projectEnv = false;
  let ssrBuild = false;
  /** Each file's path as its name on disk has it (`realpath`), and the root's, for the name tests and E1010. */
  const disk = new Map<string, string>();
  const onDisk = (file: string): string => {
    let real = disk.get(file);
    if (real === undefined) {
      try {
        real = fs.realpathSync.native(file);
      } catch {
        real = file;
      }
      disk.set(file, real);
    }
    return real;
  };
  // Extra origins the inspect endpoint answers: comma-separated, e.g. `http://localhost:*`.
  const origins = (process.env.KEEL_INSPECT_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o !== "");
  const written = new Map<string, string>();
  let devApps: DevApp[] = [];
  /** Whether this dev server answers for `node` or `static` deployables (`keel dev` of a topology that has one). */
  let hasNode = false;
  /** The closing of the last dev apps: the next ones load after it, so two never run on one storage. */
  let closed: Promise<unknown> = Promise.resolve();
  /** The load of the dev apps in flight, if any: an edit during it reloads as one after it does (k.data Dev). */
  let loading: Promise<DevApp[]> | undefined;
  /** Whether a load has evaluated the server graph since it was last invalidated whole: an edit then has one to reload. */
  let evaluated = false;
  /** Under `keel dev`: the stack each capability was registered on, by name, as `register` records it (k.data Dev). */
  const registrations = new Map<string, string>();
  /** Invalidate the server graph whole, so the next load starts with an empty registry (k.data Dev). */
  const invalidateWhole = (): void => {
    registrations.clear();
    server?.moduleGraph.invalidateAll?.();
    evaluated = false;
  };
  /** `keel dev`: every `node` and `static` deployable's dev app, loaded through Vite's SSR loader (k.topology Local topology). */
  const dev: ReturnType<typeof devMiddleware> = devMiddleware(() => {
    const run = (async (): Promise<DevApp[]> => {
      await closed;
      evaluated = true;
      const mod = await server?.ssrLoadModule?.(DEV_ENTRY);
      const apps: unknown = mod?.apps;
      return (Array.isArray(apps) ? apps : [])
        .filter(isDevApp)
        .map(([name, app, served, mount]) => ({ name, app, served, mount }));
    })();
    loading = run;
    // Only the load no edit overtook becomes the live apps. One an edit overtook is closed by `reloadDev`, and its
    // requests wait for the next load. One that failed leaves a graph half evaluated: the next request loads it whole.
    return run.then(
      (apps) => {
        if (loading !== run) return dev.apps();
        loading = undefined;
        devApps = apps;
        return apps;
      },
      (e: unknown) => {
        if (loading !== run) return dev.apps();
        invalidateWhole();
        reloadDev();
        throw e;
      },
    );
  });
  const inspect = inspectMiddleware(
    () => root,
    origins,
    // The loaded apps with their names: `dev.apps()` loads them into `devApps`.
    async () => {
      if (!hasNode) return [];
      await dev.apps();
      return devApps.map((a) => ({ name: a.name, app: a.app }));
    },
  );
  /** Close the dev apps (their runners and streams) so the next request loads them again, once they have closed. */
  const reloadDev = (): void => {
    const old = devApps;
    // A load in flight may have read the files before the edit: its apps close too, what it evaluated is invalidated
    // whole once it settles, and the next request loads anew.
    const overtaken = loading;
    loading = undefined;
    devApps = [];
    dev.reset();
    const closing = Promise.allSettled([
      closed,
      ...old.map((a) => a.app.close()),
      ...(overtaken === undefined
        ? []
        : [overtaken.then((apps) => Promise.allSettled(apps.map((a) => a.app.close())))]),
    ]);
    closed = overtaken === undefined ? closing : closing.then(invalidateWhole);
    const mod = server?.moduleGraph.getModuleById(`\0${DEV_ENTRY}`);
    if (mod !== undefined) server?.moduleGraph.invalidateModule?.(mod);
  };

  /** A `/@keel/` id split into its path and its `?d=` deployable (`/@keel/entry.ts?d=web`); undefined for any other. */
  const keyed = (id: string): { path: string; d: string | undefined } | undefined => {
    if (!id.startsWith("/@keel/")) return undefined;
    const u = new URL(id, "http://keel.invalid");
    return { path: u.pathname, d: u.searchParams.get("d") ?? undefined };
  };

  /** Whether `id` is a module the plugin generates: the client and islands entries, the server and dev entries. */
  const generated = (id: string): boolean => {
    const at = keyed(id)?.path;
    return at === ENTRY_PATH || at === ISLANDS_PATH || id === `\0${SERVER_ENTRY}` || id === `\0${DEV_ENTRY}`;
  };

  const relOf = (id: string): string | null => {
    if (id.startsWith("\0") || id.startsWith("/@keel/") || id === CSS_ID) return null;
    const file = id.split("?")[0] ?? id;
    if (!CODE.test(file) || file.includes("/node_modules/") || file.endsWith(".d.ts")) return null;
    // only app code under the root: linked workspace packages resolve to real paths outside it
    const rel = path.relative(root, file);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    const posix = rel.split(path.sep).join("/");
    return NOT_APP.test(posix) ? null : posix;
  };
  /** Whether `id` is a source file outside the project root and outside any `node_modules`. */
  const linked = (id: string): boolean => {
    const file = id.split("?")[0] ?? id;
    return (
      path.isAbsolute(file) &&
      CODE.test(file) &&
      !file.includes("/node_modules/") &&
      path.relative(root, file).startsWith("..")
    );
  };
  const exists = (rel: string): boolean => fs.existsSync(path.join(root, rel));

  /**
   * The deployable this build serves: `want` (a dev entry's `?d=`, else `KEEL_DEPLOYABLE`), else the first `client`
   * one by name, else every `node` one's modules, else the first `static` one by name.
   */
  const deployable = (
    want = process.env.KEEL_DEPLOYABLE,
  ): { name: string; modules: readonly string[]; client: boolean } | undefined => {
    if (topology === undefined) return undefined;
    const names = Object.keys(topology).sort();
    const of = (adapter: string): string[] => names.filter((n) => topology?.[n]?.adapter === adapter);
    const node = of("node");
    const name = want ?? of("client")[0] ?? (node.length > 0 ? undefined : of("static")[0]);
    // `keel dev` with no client deployable: one resume entry for every node deployable's islands (one origin).
    if (name === undefined && node.length > 0)
      return { name: node[0] ?? "", modules: node.flatMap((n) => topology?.[n]?.modules ?? []), client: false };
    const d = name === undefined ? undefined : topology[name];
    return name === undefined || d === undefined
      ? undefined
      : { name, modules: d.modules, client: d.adapter === "client" };
  };
  /**
   * The `client` deployable whose `index.html` the plugin writes (k.head Document source): the one a build hosts, else
   * the one served (`KEEL_DEPLOYABLE`, else the first `client` by name), in dev and in the project's own build.
   */
  const page = (): string | undefined => {
    if (hosting !== undefined) return hosting;
    const d = deployable();
    return d?.client === true ? d.name : undefined;
  };
  /** The deployable's `styles` (k.topology Declaration) as side-effect imports, first in its entry. */
  const styleImports = (name: string | undefined): string =>
    (name === undefined ? [] : (topology?.[name]?.styles ?? [])).map((x) => `import ${JSON.stringify(x)};\n`).join("");
  /**
   * The routes files of the deployable's modules (every module without a topology): an app module's
   * `modules/<id>/routes.ts`, root-relative; a stdlib module's package `./routes` file (`stdRoutes`), absolute.
   */
  const routesFiles = (want?: string): string[] => {
    const d = deployable(want);
    const ids =
      d?.modules ??
      (exists("modules")
        ? fs
            .readdirSync(path.join(root, "modules"), { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
        : []);
    return [...ids].sort().flatMap((m) => {
      const file = exists(`modules/${m}/routes.ts`) ? `modules/${m}/routes.ts` : stdRoutes(root, m)?.[0];
      return file === undefined ? [] : [file];
    });
  };

  /**
   * The deployable -> modules map the client entry binds service targets for: the modules of any `node` or `static` deployable
   * the client's browser code imports (`calledModules`), plus every module that has no folder under `modules/` (a placed
   * stdlib module, whose contract comes by package), so no other app module's name is in the browser build.
   */
  const calledByClient = (all: Topology, own: readonly string[]): Record<string, readonly string[]> => {
    const called = new Set(
      calledModules(own, {
        read: (f) => {
          try {
            return fs.readFileSync(path.join(root, f), "utf8");
          } catch {
            return undefined;
          }
        },
        list: (dir) => {
          try {
            return fs.readdirSync(path.join(root, dir));
          } catch {
            return [];
          }
        },
      }),
    );
    const out: Record<string, readonly string[]> = {};
    for (const [n, x] of Object.entries(all)) {
      if (x.adapter === "client") continue;
      const ms = x.modules.filter((m) => called.has(m) || !exists(`modules/${m}`));
      if (ms.length > 0) out[n] = ms;
    }
    return out;
  };
  /** The module a file is in: `modules/<id>/` under the root, else the placed stdlib module whose package holds it. */
  const moduleOf = (file: string): string | undefined => {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const app = /^modules\/([^/]+)\//.exec(rel)?.[1];
    if (app !== undefined) return app;
    const ids = Object.values(topology ?? {}).flatMap((d) => d.modules);
    return ids.find((m) => {
      const pkg = stdRoutes(root, m)?.[1];
      return pkg !== undefined && file.startsWith(`${pkg}${path.sep}`);
    });
  };
  /**
   * A server-only file (k.boundary, k.bundle Names): its name on disk `*.server.*` or `*.guard.*`, any extension, any
   * case, unless only `client` deployables list its module.
   */
  const serverOnlyFile = (file: string): boolean => {
    if (!SERVER_ONLY_NAME.test(path.basename(file)) && !SERVER_ONLY_NAME.test(path.basename(onDisk(file))))
      return false;
    const m = moduleOf(file);
    const owners = Object.values(topology ?? {}).filter((d) => m !== undefined && d.modules.includes(m));
    return owners.length === 0 || owners.some((d) => d.adapter !== "client");
  };
  /** A graph id as E1007 names it: a project-relative path, a package specifier, or the id itself. */
  const show = (id: string): string => {
    const bare = id.replace(/^\0/, "");
    if (bare.startsWith("/@keel/")) return bare.slice(1);
    const [file = bare, query] = bare.split("?");
    if (!path.isAbsolute(file)) return bare;
    const tail = query === undefined ? "" : `?${query}`;
    const rel = path.relative(root, file);
    if (!rel.startsWith("..") && !rel.split(path.sep).includes("node_modules"))
      return rel.split(path.sep).join("/") + tail;
    for (let dir = path.dirname(file); dir !== path.dirname(dir); dir = path.dirname(dir)) {
      const pkg = path.join(dir, "package.json");
      if (!fs.existsSync(pkg)) continue;
      const name: unknown = JSON.parse(fs.readFileSync(pkg, "utf8")).name;
      return `${typeof name === "string" ? name : dir}/${path.relative(dir, file).split(path.sep).join("/")}${tail}`;
    }
    return bare;
  };
  /** Why a module of a browser build's graph breaks the boundary (E1007), else undefined. */
  const breach = (id: string): string | undefined => {
    if (isNodeBuiltin(id)) return "node built-in";
    if (id.startsWith("\0") || stubbed.has(id)) return undefined;
    const file = id.split("?")[0] ?? id;
    if (path.isAbsolute(file) && serverOnlyFile(file)) return "server-only file";
    const d = deployable();
    const own = d?.client === true && d.modules.includes(moduleOf(file) ?? "");
    const named = handlers.has(id) || (WORKER_QUERY.test(id) && handlers.has(file));
    return named && !own ? "handler" : undefined;
  };
  /**
   * E1010 (k.bundle Names): `id` names a project file in a case other than its name on disk. Read from the disk, so it
   * holds on a file system that folds case; on one that does not, such a specifier does not resolve.
   */
  const miscased = (id: string): string | undefined => {
    const file = id.split("?")[0] ?? id;
    if (!path.isAbsolute(file)) return undefined;
    const rel = path.relative(root, file);
    if (rel.startsWith("..") || rel.split(path.sep).includes("node_modules") || !fs.existsSync(file)) return undefined;
    const real = path.relative(onDisk(root), onDisk(file));
    return real !== rel && real.toLowerCase() === rel.toLowerCase()
      ? `E1010 ${rel.split(path.sep).join("/")} names ${real.split(path.sep).join("/")} in another case; use the name on disk`
      : undefined;
  };
  /**
   * Whether a hook's module goes to the browser: a browser build's, or in dev the client environment's when the browser
   * loads it natively. A module runner (the dev server's own, or a test runner's on the client environment) runs the
   * file itself.
   */
  const forBrowser = (ctx: unknown, options: HookOptions): boolean => {
    if (options?.ssr !== false) return false;
    if (command === "build") return true;
    const env: unknown = typeof ctx === "object" && ctx !== null ? Reflect.get(ctx, "environment") : undefined;
    const config: unknown = typeof env === "object" && env !== null ? Reflect.get(env, "config") : undefined;
    if (typeof config !== "object" || config === null || Reflect.get(config, "consumer") !== "client") return false;
    const dev: unknown = Reflect.get(config, "dev");
    return typeof dev !== "object" || dev === null || Reflect.get(dev, "moduleRunnerTransform") !== true;
  };
  /**
   * A browser bundle's `load` (k.boundary, k.bundle): E1010 for a miscased file; a server-only JS or TS file without a
   * query is its stub, so its code and imports never load. In dev only the browser gets the stub (`forBrowser`).
   */
  const browserLoad = (id: string, browser: boolean): string | null => {
    const wrong = command === "build" ? miscased(id) : undefined;
    if (wrong !== undefined) throw new Error(wrong);
    if (!browser || id.includes("?") || !path.isAbsolute(id) || !serverOnlyFile(id)) return null;
    if (!STUB_NAME.test(onDisk(id))) return null;
    (command === "build" ? stubbed : devStubbed).add(id);
    return stubCode(show(id), exportNames(id), routerOf(id));
  };
  /**
   * Note what a browser module holds for E1007 (k.bundle): its parsed program, when it is app code or names
   * `@keel/router` (the handler binding pass reads it), and the files it names by `new URL(<literal>, import.meta.url)`.
   */
  const note = (code: string, id: string): void => {
    if (command !== "build" || id.includes("?") || !path.isAbsolute(id) || stubbed.has(id)) return;
    const app = !path.relative(root, id).startsWith("..") && !id.includes(`${path.sep}node_modules${path.sep}`);
    if (!CODE.test(id) || id.endsWith(".d.ts") || !(app || code.includes("@keel/router"))) return;
    const parsed = parseSync(id, code, { sourceType: "module" });
    if (parsed.errors.length > 0) return;
    programs.set(id, parsed.program);
    for (const u of urlLiterals(parsed.program))
      if (u.source.startsWith("."))
        urlEdges.set(id, (urlEdges.get(id) ?? new Set()).add(path.resolve(path.dirname(id), u.source)));
  };
  /** The plugin each worker bundle runs (k.bundle Bundles): built-ins left out, stubs, notes, and its graph kept. */
  const workerPlugin = (): WorkerPlugin => ({
    name: "keel:worker",
    enforce: "pre",
    resolveId: (id, importer) => (importer !== undefined && isNodeBuiltin(id) ? { id, external: true } : null),
    load: (id) => browserLoad(id, command === "build"),
    transform: (code, id) => {
      note(code, id);
      return null;
    },
    buildEnd(error) {
      if (error !== undefined) return;
      for (const id of this?.getModuleIds?.() ?? []) {
        const m = this?.getModuleInfo?.(id);
        if (m === null || m === undefined) continue;
        const into = workerGraph.get(id) ?? { importedIds: new Set(), dynamicallyImportedIds: new Set() };
        for (const x of m.importedIds) into.importedIds.add(x);
        for (const x of m.dynamicallyImportedIds) into.dynamicallyImportedIds.add(x);
        workerGraph.set(id, into);
      }
    },
  });

  /** The `@keel/router/internal` a stub of `file` imports: resolved from the file, else from the root. */
  const routerOf = (file: string): string => {
    for (const from of [file, path.join(root, "package.json")])
      try {
        return createRequire(from).resolve("@keel/router/internal");
      } catch {}
    return "@keel/router/internal";
  };

  /** Dev only: make the browser fetch `keel.css` again (it re-evaluates when stale). */
  const reloadCss = (): void => {
    const mod = server?.moduleGraph.getModuleById(CSS_ID);
    if (server !== undefined && mod !== undefined) void server.reloadModule(mod).catch(() => {});
  };

  const readTopology = (): void => {
    topology = undefined;
    if (!exists("topology.ts")) return;
    const source = fs.readFileSync(path.join(root, "topology.ts"), "utf8");
    const problems = topologyReadProblems(source);
    if (problems.length > 0) {
      const message = problems.map(([code, , p]) => `${code} topology.ts ${p}`).join("\n");
      if (command === "build") throw new Error(message);
      warn(message);
    }
    topology = parseTopology(source).topology;
  };

  const flush = (): { id: string; file: string }[] => {
    // Only app sources feed the artifacts, by the rule `keel build` and `keel check` share.
    const keys = [...modules.keys()].filter(isSourcePath).sort();
    const parts: Artifacts[] = [];
    for (const k of keys) {
      const e = modules.get(k);
      if (e !== undefined) parts.push(e.artifacts);
    }
    const { artifacts, duplicates } = mergeArtifacts(parts);
    artifacts["routes.json"] = routes;
    if (resolved) fs.mkdirSync(path.join(root, ".keel"), { recursive: true });
    const texts: [string, string][] = NAMES.map((n) => [n, artifactText(artifacts[n])]);
    texts.push(["std.json", artifactText(stdArtifact(manifests()).data)]);
    for (const [name, text] of clientBuild || !resolved ? [] : texts) {
      if (written.get(name) === text) continue;
      writeArtifact(root, name, text);
      written.set(name, text);
    }
    const usages = canonicalJson(artifacts["styles.json"]);
    if (usages !== usageKeys) {
      usageKeys = usages;
      stale = true;
      reloadCss();
    }
    return duplicates;
  };

  /** The app module manifests seen so far, with their sources. */
  const manifests = (): { path: string; source: string }[] =>
    [...modules].filter(([k]) => MANIFEST.test(k)).map(([path, e]) => ({ path, source: e.source }));

  /** Import the manifests' stdlib deps, then their E1159 and E1158 lines. */
  const stdProblems = async (): Promise<string[]> =>
    [...(await importDeps(root, manifests())), ...stdArtifact(manifests()).diagnostics].map(
      (d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}`,
    );

  const compileModule = (rel: string, code: string): Entry => {
    let entry = modules.get(rel);
    if (entry === undefined || entry.source !== code || entry.looks !== looksKey) {
      const r = compile([{ path: rel, source: code }], {
        ...(topology === undefined ? {} : { topology }),
        ...(looks === undefined ? {} : { looks }),
      });
      const failures = r.diagnostics
        // E1004 reads the whole import graph: `keel check` reports it, and a browser build fails with E1007 instead.
        .filter((d) => !/^[WI]/.test(d.code) && d.code !== "E1004")
        .map((d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}`);
      entry = { source: code, looks: looksKey, output: r.outputs[0], artifacts: r.artifacts, failures };
      modules.set(rel, entry);
    }
    return entry;
  };

  /**
   * `keel dev`'s `/@keel/styles.css?d=<name>` (k.head Server): deployable `name`'s `styles` (k.topology Declaration), each
   * resolved from the root, its package directory added to the served ones, and transformed by Vite as a direct CSS
   * request (its `url()`s served by Vite), then the atomic CSS; undefined for a name the topology lacks. Without a
   * topology, the atomic CSS alone.
   */
  const devStyles = async (d: string | undefined): Promise<string | undefined> => {
    const decl = d === undefined ? undefined : topology?.[d];
    if (topology !== undefined && decl === undefined) return undefined;
    const parts: string[] = [];
    for (const spec of decl?.styles ?? []) {
      const hit = await server?.pluginContainer?.resolveId(spec, path.join(root, "index.html"));
      const file = hit?.id.split("?")[0];
      if (file === undefined || !path.isAbsolute(file) || !fs.existsSync(file))
        throw new Error(`keel: styles entry ${JSON.stringify(spec)} of ${d ?? ""} resolves to no file`);
      // The entry's package may sit outside Vite's served roots (a linked or store-installed package): its directory
      // is served too, so the entry and the files its `url()`s name load wherever the package is installed.
      const allow = server?.config?.server.fs.allow;
      const dir = packageRoot(fs.realpathSync(file)).split(path.sep).join("/");
      if (allow !== undefined && !allow.includes(dir)) allow.push(dir);
      const rel = path.relative(root, file).split(path.sep).join("/");
      const url = rel.startsWith("..") || path.isAbsolute(rel) ? `/@fs${file.split(path.sep).join("/")}` : `/${rel}`;
      const out = await server?.transformRequest?.(`${url}?direct`);
      if (out !== null && out !== undefined) parts.push(out.code);
    }
    if (stale) await refresh();
    parts.push(css);
    return parts.join("\n");
  };

  /** Re-evaluate tokens and route manifests: `keel.css` and `routes.json`. */
  const refresh = async (): Promise<void> => {
    stale = false;
    const usages = mergeArtifacts([...modules.values()].map((e) => e.artifacts)).artifacts["styles.json"].usages;
    const r = await evaluateProject({
      root,
      tokensFile: exists("tokens.ts") ? "tokens.ts" : undefined,
      routesFiles: routesFiles(),
      usages,
    });
    for (const p of r.problems) warn(`keel: ${p}`);
    problems = r.problems;
    css = r.css;
    looks = r.looks;
    looksKey = canonicalJson(r.looks);
    routes = r.routes;
    // `keel check` cannot verify routes.json beside a routes.ts (W1005); the build can, before it rewrites it.
    const prior = path.join(root, ".keel", "routes.json");
    const next = artifactText(routes);
    if (command === "build" && !clientBuild && fs.existsSync(prior) && fs.readFileSync(prior, "utf8") !== next)
      warn("keel: W1005 .keel/routes.json differed from routes.ts; rewritten");
    flush();
    stale = false;
  };

  return {
    name: "keel",
    enforce: "pre",
    config(user, env) {
      const name = process.env.KEEL_DEPLOYABLE;
      const file = path.join(path.resolve(user.root ?? process.cwd()), "topology.ts");
      projectEnv = user.envPrefix !== undefined || user.define !== undefined;
      ssrBuild = env.isSsrBuild === true;
      // A build is the production one whatever `vite.config.ts` sets `process.env.NODE_ENV` to (k.deploy Build).
      const own = {
        envPrefix: NO_ENV,
        ...(env.command === "build"
          ? { define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" } }
          : {}),
        worker: { plugins: () => [workerPlugin()] },
      };
      if (env.command !== "build" || env.isSsrBuild === true || name === undefined || !fs.existsSync(file)) return own;
      const top = parseTopology(fs.readFileSync(file, "utf8")).topology;
      const out = `dist/${name}`;
      if (top[name]?.adapter === "client") {
        hosting = name;
        // A shell build (k.shell Build): the web build goes into the shell's `www/`; `.keel/` is the plain build's.
        const shell = shellOf();
        if (shell !== undefined) {
          clientBuild = true;
          return { ...own, build: { outDir: `${out}/${shell.kind}/www`, emptyOutDir: true } };
        }
        // One client build writes `.keel/`, as the project's own build did: the first by name.
        clientBuild =
          Object.keys(top)
            .sort()
            .find((n) => top[n]?.adapter === "client") !== name;
        return { ...own, build: { outDir: out, emptyOutDir: true } };
      }
      const adapter = top[name]?.adapter;
      if (adapter !== "node" && adapter !== "static") return own;
      clientBuild = true;
      const built = adapter === "static";
      const pg = !built && top[name]?.storage === "postgres";
      const at = path.resolve(user.root ?? process.cwd());
      // A `static` deployable's server bundle is the build's alone: it renders the documents and is removed.
      const ssrOut = built ? `node_modules/.keel/prerender/${name}` : out;
      return {
        ...own,
        build: {
          outDir: out,
          emptyOutDir: true,
          manifest: CLIENT_MANIFEST,
          rolldownOptions: { input: { entry: ENTRY_PATH } },
        },
        environments: {
          ssr: {
            resolve: { noExternal: true },
            build: {
              outDir: ssrOut,
              emptyOutDir: built,
              manifest: false,
              copyPublicDir: false,
              // An external map for the server to read frames through: positions only, sources relative to the project.
              sourcemap: true,
              rolldownOptions: {
                input: SERVER_ENTRY,
                // `pg` (std.db Postgres) requires node built-ins at run time and names an optional `pg-native`.
                ...(pg ? { external: ["pg-native"] } : {}),
                output: {
                  ...(pg ? { banner: PG_BANNER } : {}),
                  entryFileNames: "server.mjs",
                  codeSplitting: false,
                  sourcemapExcludeSources: true,
                  sourcemapPathTransform: (rel: string, map: string) =>
                    path
                      .relative(at, path.resolve(path.dirname(map), rel))
                      .split(path.sep)
                      .join("/"),
                },
              },
            },
          },
        },
        builder: {
          buildApp: async (b) => {
            await b.build(b.environments.client);
            await b.build(b.environments.ssr);
            if (built) {
              const std = path.join(at, ".keel", "std.json");
              const failed = await writeStatic(
                path.join(at, out),
                path.join(at, ssrOut, "server.mjs"),
                name,
                top,
                process.env,
                fs.existsSync(std) ? std : undefined,
              );
              if (failed.length > 0) throw evaluationFailed(failed);
              return;
            }
            copyPgliteFiles(path.join(at, out), () => pgliteDist(at));
            // Every module's routes, not the project build's: forwarding needs each peer deployable's paths.
            // Each deployable read as `node`, so the client's modules and every placed stdlib module are listed.
            const asNode = (d: { modules: readonly string[] }): Topology[string] => ({
              modules: d.modules,
              adapter: "node",
            });
            const every = Object.fromEntries(Object.entries(top).map(([n, d]) => [n, asNode(d)]));
            const all = projectManifests(every, listSources(at), at);
            const table = await evaluateProject({ root: at, tokensFile: undefined, routesFiles: all, usages: [] });
            if (table.problems.length > 0) throw evaluationFailed(table.problems);
            copyMigrations(at, path.join(at, out), top[name]?.modules ?? []);
            fs.writeFileSync(path.join(at, out, "routes.json"), artifactText(table.routes));
            if (fs.existsSync(path.join(at, ".keel", "std.json")))
              fs.copyFileSync(path.join(at, ".keel", "std.json"), path.join(at, out, "std.json"));
            for (const c of Object.keys(top).filter((n) => top[n]?.adapter === "client" && top[n]?.servedBy === name))
              hostClient(path.join(at, "dist", c), path.join(at, out), c);
          },
        },
      };
    },
    configResolved(config) {
      root = config.root;
      resolved = true;
      command = config.command;
      // The plugin owns the inlining switches (k.bundle Environment): a project `envPrefix` or `define` fails a browser
      // build before bundling, as does a prefix another plugin merged into the lock.
      const prefix = [config.envPrefix ?? NO_ENV].flat();
      const locked = prefix.length === 1 && prefix[0] === NO_ENV;
      if (command === "build" && !ssrBuild && (projectEnv || !locked))
        throw new Error(
          `E1007 server code in browser build: environment config: ${config.configFile === undefined ? "vite.config.ts" : show(config.configFile)}`,
        );
      readTopology();
    },
    configureServer(s) {
      server = s;
      s.middlewares.use(inspect);
      hasNode = Object.values(topology ?? {}).some((d) => d.adapter === "node" || d.adapter === "static");
      if (hasNode) {
        Reflect.set(globalThis, Symbol.for("keel.dev.registrations"), registrations);
        s.middlewares.use(dev.handle);
      }
      s.middlewares.use(stylesMiddleware(devStyles));
      // Keel writes the `client` document in dev too; the project's own `index.html` is never read (k.head).
      s.middlewares.use(
        pageMiddleware(async (url) => {
          const name = page();
          if (name === undefined) return undefined;
          const html = indexHtml(name, ENTRY_PATH, `${STYLES_PATH}?d=${encodeURIComponent(name)}`);
          return s.transformIndexHtml === undefined ? html : s.transformIndexHtml(url, html);
        }),
      );
    },
    configurePreviewServer(s) {
      s.middlewares.use(inspect);
    },
    async buildStart() {
      const w = this?.warn;
      if (w !== undefined) warn = (m) => w.call(this, m);
      readTopology();
      for (const rel of listSources(root)) compileModule(rel, fs.readFileSync(path.join(root, rel), "utf8"));
      const bad = await stdProblems();
      if (bad.length > 0 && command === "build" && !clientBuild) throw new Error(bad.join("\n"));
      for (const b of bad) warn(`keel: ${b}`);
      await refresh();
    },
    resolveId(id, importer, options) {
      // A browser build leaves a Node built-in unbundled and maps none, so the graph keeps it for E1007 to name.
      if (options?.ssr === false && command === "build" && importer !== undefined && isNodeBuiltin(id))
        return { id, external: true };
      if (id === CSS_IMPORT || id === CSS_ID) return CSS_ID;
      if (id === path.join(root, "index.html") && page() !== undefined) return id;
      const q = keyed(id);
      if (q?.path === ENTRY_PATH || q?.path === ISLANDS_PATH) return id;
      // A kernel package a generated module imports and the app does not list resolves from the compiler's dependencies.
      if (importer !== undefined && generated(importer)) {
        const own = entryDependency(id, root);
        if (own !== undefined) return own;
      }
      if (id === SERVER_ENTRY) return `\0${SERVER_ENTRY}`;
      if (id === DEV_ENTRY) return `\0${DEV_ENTRY}`;
      // The server build reads `node:sqlite` when the driver first runs; dev and tests leave it to Node.
      if (id === "node:sqlite") return command === "build" ? SQLITE : { id, external: true };
      return null;
    },
    async load(this: unknown, id, options) {
      if (options?.ssr === false) {
        const stub = browserLoad(id, forBrowser(this, options));
        if (stub !== null) return stub;
      } else if (command === "build") {
        const wrong = miscased(id);
        if (wrong !== undefined) throw new Error(wrong);
      }
      const shown = id === path.join(root, "index.html") ? page() : undefined;
      if (shown !== undefined) return indexHtml(shown, ENTRY_PATH);
      if (id === CSS_ID) {
        if (stale) await refresh();
        return css;
      }
      const q = keyed(id);
      if (q?.path === ISLANDS_PATH)
        return islandsCode(
          routesFiles(q.d).map((f) => ({ path: f, source: fs.readFileSync(path.resolve(root, f), "utf8") })),
        );
      if (id === `\0${DEV_ENTRY}`) return devEntryCode(root, topology ?? {});
      if (id === SQLITE) return SQLITE_CODE;
      const node = deployable();
      if (id === `\0${SERVER_ENTRY}` && node !== undefined)
        return serverEntryCode(
          root,
          node.name,
          node.modules,
          topology?.[node.name]?.storage,
          Object.fromEntries(
            Object.entries(topology ?? {}).flatMap(([n, d]) => (d.origins === undefined ? [] : [[n, d.origins]])),
          ),
          topology?.[node.name]?.adapter === "static" ? "static" : "node",
        );
      if (q?.path !== ENTRY_PATH) return null;
      const d = deployable(q.d);
      if (d === undefined) throw new Error(noDeployable(ENTRY_PATH, topology, q.d ?? process.env.KEEL_DEPLOYABLE));
      const mode = command === "serve" ? "dev" : "production";
      if (!d.client) return styleImports(q.d ?? d.name) + resumeEntry(q.d, mode, CSS_IMPORT);
      const all = topology ?? {};
      const served = Object.values(all).some((x) => x.adapter === "node");
      const targets = served ? calledByClient(all, d.modules) : {};
      mapped = served ? new Set([...d.modules, ...Object.values(targets).flat()]) : undefined;
      return (
        styleImports(d.name) +
        entryCode(
          routesFiles(q.d).map((f) => (path.isAbsolute(f) ? f : `/${f}`)),
          CSS_IMPORT,
          clientStdData(stdArtifact(manifests()).data, new Set(d.modules)),
          targets,
          shellOf(all, d.name),
          mode,
          exists("identity.ts"),
          served,
          d.name,
        )
      );
    },
    transformIndexHtml() {
      if (hosting === undefined || topology === undefined) return [];
      const peers = peerOrigins(topology, process.env);
      if (peers.bad.length > 0) throw new Error(`E1565 ${peers.bad[0]} is not an http(s) origin; set it to one`);
      return peers.origins.map(([n, origin]) => ({
        tag: "meta",
        attrs: { name: "keel-peer", "data-deployable": n, content: origin },
        injectTo: "head",
      }));
    },
    buildEnd(error) {
      if (error !== undefined || command !== "build" || this?.environment?.config.consumer !== "client") return;
      const uses = projectHandlerUses([...programs].map(([file, program]) => ({ path: file, program })));
      for (const [file, list] of uses) if (list.length > 0) handlers.add(file);
      // The graph of every bundle the build emitted: a `?worker` module, and a file a module names by `new URL`, lead
      // into that worker's bundle, so a worker's chain runs through the file that names it (k.bundle Bundles).
      const info = (id: string): ModuleInfo | null => {
        const own = this.getModuleInfo?.(id) ?? null;
        const worker = workerGraph.get(WORKER_QUERY.test(id) ? (id.split("?")[0] ?? id) : id);
        const named = urlEdges.get(id);
        if (own === null && worker === undefined && named === undefined) return null;
        return {
          isEntry: own?.isEntry ?? false,
          importedIds: [...(own?.importedIds ?? []), ...(worker?.importedIds ?? []), ...(named ?? [])],
          dynamicallyImportedIds: [...(own?.dynamicallyImportedIds ?? []), ...(worker?.dynamicallyImportedIds ?? [])],
        };
      };
      const why = browserBreach(this.getModuleIds?.() ?? [], info, breach, show, (id) => stubbed.has(id));
      if (why !== undefined) throw new Error(`E1007 ${why}`);
      // E1011 (k.bundle Service map): the entry maps the modules the scan found; one the bundler reached by another way
      // (a computed import(), found by glob) would send its calls to an origin that is not its deployable's.
      if (mapped === undefined) return;
      const topo = Object.values(topology ?? {});
      const unmapped = unmappedModule(
        this.getModuleIds?.() ?? [],
        (id) => {
          const file = id.split("?")[0] ?? id;
          if (id.startsWith("\0") || !path.isAbsolute(file)) return undefined;
          const m = moduleOf(file);
          return m !== undefined &&
            exists(`modules/${m}`) &&
            topo.some((x) => x.adapter !== "client" && x.modules.includes(m))
            ? m
            : undefined;
        },
        mapped,
        (id) => stubbed.has(id) || serverOnlyFile(id.split("?")[0] ?? id),
        (id) => {
          const info = this.getModuleInfo?.(id);
          return [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])];
        },
      );
      const lead = unmapped === undefined ? "" : `${unmapped.module} is not in the client's service map: imported by `;
      if (unmapped !== undefined)
        throw new Error(`E1011 ${lead}${shortPath(show(unmapped.importer), 89 - lead.length)}`);
    },
    generateBundle: {
      order: "post",
      // After bundling, no emitted browser file holds a `KEEL_*` value of 8 characters or more (k.bundle Environment).
      handler(_options, bundle) {
        if (command !== "build" || this?.environment?.config.consumer !== "client") return;
        const values = Object.entries(process.env).filter(
          (e): e is [string, string] => e[0].startsWith("KEEL_") && !PUBLIC_ENV.test(e[0]) && (e[1] ?? "").length >= 8,
        );
        if (values.length === 0) return;
        const decoder = new TextDecoder();
        const out = this.environment.config.build?.outDir ?? "dist";
        for (const f of Object.values(bundle)) {
          const text = f.code ?? (typeof f.source === "string" ? f.source : decoder.decode(f.source));
          const hit = values.find(([, v]) => text.includes(v));
          if (hit !== undefined)
            throw new Error(
              `E1007 server code in browser build: environment value: ${hit[0]} -> ${show(path.resolve(root, out, f.fileName))}`,
            );
        }
      },
    },
    renderStart() {
      // Each evaluation problem fails a build, after the bundle's own checks (E1007, E1011) have run; dev prints it and
      // keeps serving (k.compiler Build-time evaluation).
      if (command === "build" && problems.length > 0) throw evaluationFailed(problems);
    },
    closeBundle() {
      const mark = path.join(root, "dist", hosting ?? "", "keel-mark.svg");
      // A failed build wrote no `dist/<name>/`, and gets no mark either.
      if (hosting !== undefined && fs.existsSync(path.dirname(mark)) && !fs.existsSync(mark))
        fs.writeFileSync(mark, keelMark());
    },
    transform(this: unknown, code, id, options) {
      if (options?.ssr === false) note(code, id);
      const rel = relOf(id);
      if (rel === null || stubbed.has(id) || (devStubbed.has(id) && forBrowser(this, options))) return null;
      const entry = compileModule(rel, code);
      const dupes = flush()
        .filter((d) => d.file === rel)
        .map((d) => `E1404 ${rel} duplicate element id "${d.id.slice(0, 30)}" (also in another module)`);
      const failures = [...entry.failures, ...dupes];
      if (failures.length > 0) throw new Error(failures.join("\n"));
      return entry.output === undefined ? null : { code: entry.output.code, map: null };
    },
    watchChange(id, change) {
      const rel = relOf(id);
      // A source outside the project (a linked package) is evaluated again by the modules that import it, not by the
      // ones it registered with: the whole server graph loads again, so a registry and its registrations agree.
      if (rel === null && evaluated && linked(id)) {
        invalidateWhole();
        reloadDev();
      }
      if (rel !== null && evaluated && (rel.startsWith("modules/") || PROJECT_FILE.test(rel))) {
        // An app file that registered a capability, itself or through a helper it called, or that names a registering
        // export, loads the server graph again whole (k.data Dev): the registry starts empty, and a capability two
        // files register is still E1602.
        const abs = path.join(root, rel);
        if (
          registeredIn(registrations.values(), abs) ||
          (exists(rel) && registersCapability(fs.readFileSync(abs, "utf8")))
        )
          invalidateWhole();
        reloadDev();
      }
      if (rel !== null && change.event === "delete" && modules.delete(rel)) flush();
      else if (rel !== null && MANIFEST.test(rel) && exists(rel)) {
        compileModule(rel, fs.readFileSync(path.join(root, rel), "utf8"));
        // New deps load before std.json is rewritten; problems go where dev's other ones do.
        void stdProblems()
          .then((bad) => {
            for (const b of bad) warn(`keel: ${b}`);
            flush();
            // A `client` entry embeds std.json: reload it with the new config.
            const entry = server?.moduleGraph.getModuleById(ENTRY_PATH);
            if (server !== undefined && entry !== undefined) return server.reloadModule(entry);
          })
          .catch((e: unknown) => warn(`keel: ${e instanceof Error ? e.message : String(e)}`));
      }
      if (rel === null || !PROJECT_FILE.test(rel)) return;
      if (rel === "topology.ts") {
        readTopology();
        for (const [k, e] of [...modules]) {
          modules.delete(k);
          compileModule(k, e.source);
        }
      }
      stale = true;
      if (server !== undefined)
        void refresh()
          .then(reloadCss)
          .catch((e: unknown) => warn(`keel: ${e instanceof Error ? e.message : String(e)}`));
    },
  };
}
