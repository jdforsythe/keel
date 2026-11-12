import fs from "node:fs";
import path from "node:path";
import { compile } from "./compile.ts";
import { CLIENT_MANIFEST } from "./entry/CLIENT_MANIFEST.ts";
import { DEV_ENTRY } from "./entry/DEV_ENTRY.ts";
import { ENTRY_PATH } from "./entry/ENTRY_PATH.ts";
import { ISLANDS_PATH } from "./entry/ISLANDS_PATH.ts";
import { RESUME_ENTRY } from "./entry/RESUME_ENTRY.ts";
import { SERVER_ENTRY } from "./entry/SERVER_ENTRY.ts";
import { peerOrigins } from "./hosting/peerOrigins.ts";
import { topologyReadProblems } from "./hosting/topologyReadProblems.ts";
import { artifactText } from "./internal/artifactText.ts";
import { canonicalJson } from "./internal/canonicalJson.ts";
import { devEntryCode } from "./internal/devEntryCode.ts";
import { devMiddleware } from "./internal/devMiddleware.ts";
import { entryCode } from "./internal/entryCode.ts";
import { evaluateProject } from "./internal/evaluateProject.ts";
import { hostClient } from "./internal/hostClient.ts";
import { indexHtml } from "./internal/indexHtml.ts";
import { inspectMiddleware } from "./internal/inspectMiddleware.ts";
import { isSourcePath } from "./internal/isSourcePath.ts";
import { islandsCode } from "./internal/islandsCode.ts";
import { keelMark } from "./internal/keelMark.ts";
import { listSources } from "./internal/listSources.ts";
import { mergeArtifacts } from "./internal/mergeArtifacts.ts";
import { parseTopology } from "./internal/parseTopology.ts";
import { projectManifests } from "./internal/projectManifests.ts";
import { serverEntryCode } from "./internal/serverEntryCode.ts";
import { writeArtifact } from "./internal/writeArtifact.ts";
import { clientStdData } from "./std/clientStdData.ts";
import { importDeps } from "./std/importDeps.ts";
import { stdArtifact } from "./stdArtifact.ts";
import type { Artifacts } from "./types/Artifacts.ts";
import type { Output } from "./types/Output.ts";
import type { RouteEntry } from "./types/RouteEntry.ts";
import type { Topology } from "./types/Topology.ts";

const CODE = /\.[cm]?[jt]sx?$/;
/** Test code and tool configs are not app code: no rules, no lowering (k.testing lint E1701 covers tests, D37). */
const NOT_APP =
  /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)vitest(?:\.[\w-]+)?\.config\.[cm]?[jt]s$/;
const NAMES: readonly (keyof Artifacts)[] = ["a11y.json", "deps.json", "ids.json", "routes.json", "styles.json"];
/** What app code (the generated entry) imports for the atomic CSS, and the id it resolves to. */
const CSS_IMPORT = "virtual:keel.css";
const CSS_ID = "/__keel.css";
/** Files whose change can alter the CSS or `routes.json` beyond one module's own usages. */
const PROJECT_FILE = /(?:^|\/)(?:tokens|topology|routes)\.ts$|\.schema\.ts$/;
/** App module manifests: their `std` entries are `std.json` (rfc:0066). */
const MANIFEST = /^modules\/[^/]+\/module\.[cm]?[jt]s$/;

type Entry = { source: string; output: Output | undefined; artifacts: Artifacts; failures: string[] };
type ModuleNode = object;
type Middlewares = { use(fn: ReturnType<typeof inspectMiddleware>): void };
type DevServer = {
  moduleGraph: { getModuleById(id: string): ModuleNode | undefined; invalidateModule?(module: ModuleNode): void };
  reloadModule(module: ModuleNode): Promise<void>;
  ssrLoadModule?(id: string): Promise<Record<string, unknown>>;
  middlewares: Middlewares;
};
type DevApp = {
  readonly app: { fetch(req: Request): Promise<Response>; close(): Promise<void> };
  served(path: string): boolean;
};
const isDevApp = (v: unknown): v is [string, DevApp["app"], DevApp["served"]] =>
  Array.isArray(v) &&
  typeof v[2] === "function" &&
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

/**
 * The Keel Vite plugin (k.compiler): no options. Each transform compiles only the changed module
 * (cached by source text), fails the module on diagnostics, and merges its artifacts with those of the
 * other modules seen so far. `.keel/<name>` (`{ data, hash }`, sorted keys, read-only) is rewritten
 * atomically (temp file + rename) and only when its content changed. Deleted modules are evicted.
 *
 * Project inputs (D24-D25): `buildStart` compiles every app source once (style usages for the CSS), reads
 * `topology.ts` statically (E1004 exemption for `client` deployables), and evaluates `tokens.ts` and the
 * deployable's `modules/<id>/routes.ts` to produce `keel.css` (`import "virtual:keel.css"`) and `routes.json`.
 * It serves the generated entry at `/@keel/entry.ts` for the deployable `KEEL_DEPLOYABLE` names, else the first
 * `client` one by name: the `mount` entry for a `client` deployable (binding the client-readable part of `std.json`,
 * `clientStdData`, reloaded when a manifest changes; rfc:0069), else the resume entry, whose island components
 * `/@keel/islands.ts` lists from the deployable's `routes.ts` files (RFC 0046). A `vite build` whose `KEEL_DEPLOYABLE`
 * is a `node` deployable builds that entry alone (input `entry`) into `dist/<name>/` with hashed `assets/` and the
 * manifest `CLIENT_MANIFEST` (k.server Build, RFC 0048), then its generated production entry (`SERVER_ENTRY`,
 * `serverEntryCode`) with every dependency into `dist/<name>/server.mjs` beside `routes.json`, every module's routes
 * (`projectManifests` without a topology, evaluated), and a copy of `.keel/std.json` (k.topology Build), and writes no `.keel/` artifacts (the project's own build does); any other build keeps the project's own Vite config. `buildStart` also imports the stdlib packages in the app
 * manifests' `deps` and writes `std.json` (`stdArtifact`); there a bad dep (E1159) or `std` entry (E1158) fails a build
 * and warns in dev, as does a changed manifest, whose new deps load before `std.json` is rewritten (rfc:0066).
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
  config: (
    user: { root?: string },
    env: { command: "build" | "serve"; isSsrBuild?: boolean },
  ) => BuildConfig | ClientConfig | null;
  configResolved: (config: { root: string; command?: "build" | "serve" }) => void;
  configureServer: (server: DevServer) => void;
  configurePreviewServer: (server: { middlewares: Middlewares }) => void;
  buildStart: (this: { warn?: Warn } | undefined) => Promise<void>;
  resolveId: (id: string) => string | null;
  load: (id: string) => Promise<string | null>;
  transformIndexHtml: () => HtmlTag[];
  closeBundle: () => void;
  transform: (code: string, id: string) => { code: string; map: null } | null;
  watchChange: (id: string, change: { event: "create" | "update" | "delete" }) => void;
} {
  let root = process.cwd();
  let command: "build" | "serve" = "serve";
  let server: DevServer | undefined;
  let topology: Topology | undefined;
  let routes: Record<string, RouteEntry> = {};
  let css = "";
  let stale = true;
  let usageKeys = "";
  let warn: Warn = () => {};
  /** A node deployable's client build (`config`) leaves `.keel/` to the project's own build: no artifact writes. */
  let clientBuild = false;
  /** The `client` deployable a `vite build` with `KEEL_DEPLOYABLE` naming one writes to `dist/<name>/` (k.hosting). */
  let hosting: string | undefined;
  const modules = new Map<string, Entry>();
  // Extra origins the inspect endpoint answers (RFC 0022): comma-separated, e.g. `http://localhost:*`.
  const origins = (process.env.KEEL_INSPECT_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o !== "");
  const inspect = inspectMiddleware(() => root, origins);
  const written = new Map<string, string>();
  let devApps: DevApp[] = [];
  /** The closing of the last dev apps: the next ones load after it, so two never run on one storage. */
  let closed: Promise<unknown> = Promise.resolve();
  /** `keel dev`: every `node` deployable's dev app, loaded through Vite's SSR loader (k.topology Local topology). */
  const dev = devMiddleware(async () => {
    await closed;
    const mod = await server?.ssrLoadModule?.(DEV_ENTRY);
    const apps: unknown = mod?.apps;
    devApps = (Array.isArray(apps) ? apps : []).filter(isDevApp).map(([, app, served]) => ({ app, served }));
    return devApps;
  });
  /** Close the dev apps (their runners and streams) so the next request loads them again, once they have closed. */
  const reloadDev = (): void => {
    const old = devApps;
    devApps = [];
    dev.reset();
    closed = Promise.allSettled([closed, ...old.map((a) => a.app.close())]);
    const mod = server?.moduleGraph.getModuleById(`\0${DEV_ENTRY}`);
    if (mod !== undefined) server?.moduleGraph.invalidateModule?.(mod);
  };

  const relOf = (id: string): string | null => {
    if (id.startsWith("\0") || id.startsWith("/@keel/") || id === CSS_ID) return null;
    const file = id.split("?")[0] ?? id;
    if (!CODE.test(file) || file.includes("/node_modules/") || file.endsWith(".d.ts")) return null;
    // only app code under the root: linked workspace packages resolve to real paths outside it (D25)
    const rel = path.relative(root, file);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    const posix = rel.split(path.sep).join("/");
    return NOT_APP.test(posix) ? null : posix;
  };
  const exists = (rel: string): boolean => fs.existsSync(path.join(root, rel));

  /** The deployable this build serves: `KEEL_DEPLOYABLE`, else the first `client` one by name, else every `node` one's modules. */
  const deployable = (): { name: string; modules: readonly string[]; client: boolean } | undefined => {
    if (topology === undefined) return undefined;
    const names = Object.keys(topology).sort();
    const want = process.env.KEEL_DEPLOYABLE;
    const name = want ?? names.find((n) => topology?.[n]?.adapter === "client");
    const node = names.filter((n) => topology?.[n]?.adapter === "node");
    // `keel dev` with no client deployable: one resume entry for every node deployable's islands (one origin).
    if (name === undefined && node.length > 0)
      return { name: node[0] ?? "", modules: node.flatMap((n) => topology?.[n]?.modules ?? []), client: false };
    const d = name === undefined ? undefined : topology[name];
    return name === undefined || d === undefined
      ? undefined
      : { name, modules: d.modules, client: d.adapter === "client" };
  };
  /** `modules/<id>/routes.ts` of the deployable's modules (every module without a topology), root-relative. */
  const routesFiles = (): string[] => {
    const d = deployable();
    const ids =
      d?.modules ??
      (exists("modules")
        ? fs
            .readdirSync(path.join(root, "modules"), { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
        : []);
    return [...ids]
      .sort()
      .map((m) => `modules/${m}/routes.ts`)
      .filter(exists);
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
    // Only app sources feed the artifacts, by the rule `keel build` and `keel check` share (rfc:0050).
    const keys = [...modules.keys()].filter(isSourcePath).sort();
    const parts: Artifacts[] = [];
    for (const k of keys) {
      const e = modules.get(k);
      if (e !== undefined) parts.push(e.artifacts);
    }
    const { artifacts, duplicates } = mergeArtifacts(parts);
    artifacts["routes.json"] = routes;
    fs.mkdirSync(path.join(root, ".keel"), { recursive: true });
    const texts: [string, string][] = NAMES.map((n) => [n, artifactText(artifacts[n])]);
    texts.push(["std.json", artifactText(stdArtifact(manifests()).data)]);
    for (const [name, text] of clientBuild ? [] : texts) {
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

  /** Import the manifests' stdlib deps, then their E1159 and E1158 lines (rfc:0066). */
  const stdProblems = async (): Promise<string[]> =>
    [...(await importDeps(root, manifests())), ...stdArtifact(manifests()).diagnostics].map(
      (d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}`,
    );

  const compileModule = (rel: string, code: string): Entry => {
    let entry = modules.get(rel);
    if (entry === undefined || entry.source !== code) {
      const r = compile([{ path: rel, source: code }], topology === undefined ? {} : { topology });
      const failures = r.diagnostics
        .filter((d) => !/^[WI]/.test(d.code))
        .map((d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}`);
      entry = { source: code, output: r.outputs[0], artifacts: r.artifacts, failures };
      modules.set(rel, entry);
    }
    return entry;
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
    css = r.css;
    routes = r.routes;
    // `keel check` cannot verify routes.json beside a routes.ts (W1005); the build can, before it rewrites it (rfc:0055).
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
      if (env.command !== "build" || env.isSsrBuild === true || name === undefined || !fs.existsSync(file)) return null;
      const top = parseTopology(fs.readFileSync(file, "utf8")).topology;
      const out = `dist/${name}`;
      if (top[name]?.adapter === "client") {
        hosting = name;
        // One client build writes `.keel/`, as the project's own build did: the first by name.
        clientBuild =
          Object.keys(top)
            .sort()
            .find((n) => top[n]?.adapter === "client") !== name;
        return { build: { outDir: out, emptyOutDir: true } };
      }
      if (top[name]?.adapter !== "node") return null;
      clientBuild = true;
      const at = path.resolve(user.root ?? process.cwd());
      return {
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
              outDir: out,
              emptyOutDir: false,
              manifest: false,
              copyPublicDir: false,
              rolldownOptions: { input: SERVER_ENTRY, output: { entryFileNames: "server.mjs", codeSplitting: false } },
            },
          },
        },
        builder: {
          buildApp: async (b) => {
            await b.build(b.environments.client);
            await b.build(b.environments.ssr);
            // Every module's routes, not the project build's: forwarding needs each peer deployable's paths.
            const all = projectManifests(undefined, listSources(at));
            const table = await evaluateProject({ root: at, tokensFile: undefined, routesFiles: all, usages: [] });
            fs.writeFileSync(path.join(at, out, "routes.json"), artifactText(table.routes));
            if (fs.existsSync(path.join(at, ".keel", "std.json")))
              fs.copyFileSync(path.join(at, ".keel", "std.json"), path.join(at, out, "std.json"));
            for (const c of Object.keys(top).filter((n) => top[n]?.adapter === "client" && top[n]?.host === name))
              hostClient(path.join(at, "dist", c), path.join(at, out), c);
          },
        },
      };
    },
    configResolved(config) {
      root = config.root;
      command = config.command ?? "serve";
      readTopology();
    },
    configureServer(s) {
      server = s;
      s.middlewares.use(inspect);
      if (Object.values(topology ?? {}).some((d) => d.adapter === "node")) s.middlewares.use(dev.handle);
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
    resolveId(id) {
      if (id === CSS_IMPORT || id === CSS_ID) return CSS_ID;
      if (hosting !== undefined && id === path.join(root, "index.html") && !exists("index.html")) return id;
      if (id === ENTRY_PATH || id === ISLANDS_PATH) return id;
      if (id === SERVER_ENTRY) return `\0${SERVER_ENTRY}`;
      if (id === DEV_ENTRY) return `\0${DEV_ENTRY}`;
      return null;
    },
    async load(id) {
      if (hosting !== undefined && id === path.join(root, "index.html") && !exists("index.html"))
        return indexHtml(hosting, ENTRY_PATH);
      if (id === CSS_ID) {
        if (stale) await refresh();
        return css;
      }
      if (id === ISLANDS_PATH)
        return islandsCode(
          routesFiles().map((f) => ({ path: f, source: fs.readFileSync(path.join(root, f), "utf8") })),
        );
      if (id === `\0${DEV_ENTRY}`) return devEntryCode(root, topology ?? {});
      const node = deployable();
      if (id === `\0${SERVER_ENTRY}` && node !== undefined) return serverEntryCode(root, node.name, node.modules);
      if (id !== ENTRY_PATH) return null;
      const d = deployable();
      if (d === undefined)
        throw new Error(`keel: ${ENTRY_PATH} needs a client deployable in topology.ts, or KEEL_DEPLOYABLE naming one`);
      if (!d.client) return RESUME_ENTRY;
      const all = topology ?? {};
      const served = Object.values(all).some((x) => x.adapter === "node");
      return entryCode(
        routesFiles().map((f) => `/${f}`),
        CSS_IMPORT,
        clientStdData(stdArtifact(manifests()).data, new Set(d.modules)),
        served ? Object.fromEntries(Object.entries(all).map(([n, x]) => [n, x.modules])) : {},
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
    closeBundle() {
      const mark = path.join(root, "dist", hosting ?? "", "keel-mark.svg");
      if (hosting !== undefined && !fs.existsSync(mark)) fs.writeFileSync(mark, keelMark());
    },
    transform(code, id) {
      const rel = relOf(id);
      if (rel === null) return null;
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
      if (rel !== null && devApps.length > 0 && (rel.startsWith("modules/") || PROJECT_FILE.test(rel))) reloadDev();
      if (rel !== null && change.event === "delete" && modules.delete(rel)) flush();
      else if (rel !== null && MANIFEST.test(rel) && exists(rel)) {
        compileModule(rel, fs.readFileSync(path.join(root, rel), "utf8"));
        // New deps load before std.json is rewritten; problems go where dev's other ones do (backlog 0196).
        void stdProblems()
          .then((bad) => {
            for (const b of bad) warn(`keel: ${b}`);
            flush();
            // A `client` entry embeds std.json (rfc:0069): reload it with the new config.
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
