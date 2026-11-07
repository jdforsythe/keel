import fs from "node:fs";
import path from "node:path";
import { compile } from "./compile.ts";
import { CLIENT_MANIFEST } from "./entry/CLIENT_MANIFEST.ts";
import { ENTRY_PATH } from "./entry/ENTRY_PATH.ts";
import { ISLANDS_PATH } from "./entry/ISLANDS_PATH.ts";
import { RESUME_ENTRY } from "./entry/RESUME_ENTRY.ts";
import { artifactText } from "./internal/artifactText.ts";
import { canonicalJson } from "./internal/canonicalJson.ts";
import { entryCode } from "./internal/entryCode.ts";
import { evaluateProject } from "./internal/evaluateProject.ts";
import { inspectMiddleware } from "./internal/inspectMiddleware.ts";
import { isSourcePath } from "./internal/isSourcePath.ts";
import { islandsCode } from "./internal/islandsCode.ts";
import { listSources } from "./internal/listSources.ts";
import { mergeArtifacts } from "./internal/mergeArtifacts.ts";
import { parseTopology } from "./internal/parseTopology.ts";
import { writeArtifact } from "./internal/writeArtifact.ts";
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

type Entry = { source: string; output: Output | undefined; artifacts: Artifacts; failures: string[] };
type ModuleNode = object;
type Middlewares = { use(fn: ReturnType<typeof inspectMiddleware>): void };
type DevServer = {
  moduleGraph: { getModuleById(id: string): ModuleNode | undefined };
  reloadModule(module: ModuleNode): Promise<void>;
  middlewares: Middlewares;
};
type Warn = (message: string) => void;
type BuildConfig = {
  build: {
    outDir: string;
    emptyOutDir: true;
    manifest: string;
    rolldownOptions: { input: Record<string, string> };
  };
};

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
 * `client` one by name: the `mount` entry for a `client` deployable, else the resume entry, whose island components
 * `/@keel/islands.ts` lists from the deployable's `routes.ts` files (RFC 0046). A `vite build` whose `KEEL_DEPLOYABLE`
 * is a `node` deployable builds that entry alone (input `entry`) into `dist/<name>/` with hashed `assets/` and the
 * manifest `CLIENT_MANIFEST` (k.server Build, RFC 0048), and writes no `.keel/` artifacts (the project's own build
 * does); any other build keeps the project's own Vite config.
 *
 * Dev and preview servers serve `/__keel/inspect` (k.cli Inspect): the `.keel/` artifacts plus the live graph and
 * stores the open page's dev entry last posted, to the server's own origin and those `KEEL_INSPECT_ORIGINS` lists.
 */
export default function (): {
  name: string;
  enforce: "pre";
  config: (user: { root?: string }, env: { command: "build" | "serve"; isSsrBuild?: boolean }) => BuildConfig | null;
  configResolved: (config: { root: string; command?: "build" | "serve" }) => void;
  configureServer: (server: DevServer) => void;
  configurePreviewServer: (server: { middlewares: Middlewares }) => void;
  buildStart: (this: { warn?: Warn } | undefined) => Promise<void>;
  resolveId: (id: string) => string | null;
  load: (id: string) => Promise<string | null>;
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
  const modules = new Map<string, Entry>();
  // Extra origins the inspect endpoint answers (RFC 0022): comma-separated, e.g. `http://localhost:*`.
  const origins = (process.env.KEEL_INSPECT_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o !== "");
  const inspect = inspectMiddleware(() => root, origins);
  const written = new Map<string, string>();

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

  /** The deployable this build serves: `KEEL_DEPLOYABLE`, else the first `client` one by name. */
  const deployable = (): { name: string; modules: readonly string[]; client: boolean } | undefined => {
    if (topology === undefined) return undefined;
    const names = Object.keys(topology).sort();
    const want = process.env.KEEL_DEPLOYABLE;
    const name = want ?? names.find((n) => topology?.[n]?.adapter === "client");
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
    const r = parseTopology(fs.readFileSync(path.join(root, "topology.ts"), "utf8"));
    if (r.problems.length > 0) {
      const message = `keel: topology.ts: ${r.problems.join("; ")}`;
      if (command === "build") throw new Error(message);
      warn(message);
    }
    topology = r.topology;
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
    for (const name of clientBuild ? [] : NAMES) {
      const text = artifactText(artifacts[name]);
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
      if (parseTopology(fs.readFileSync(file, "utf8")).topology[name]?.adapter !== "node") return null;
      clientBuild = true;
      return {
        build: {
          outDir: `dist/${name}`,
          emptyOutDir: true,
          manifest: CLIENT_MANIFEST,
          rolldownOptions: { input: { entry: ENTRY_PATH } },
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
    },
    configurePreviewServer(s) {
      s.middlewares.use(inspect);
    },
    async buildStart() {
      const w = this?.warn;
      if (w !== undefined) warn = (m) => w.call(this, m);
      readTopology();
      for (const rel of listSources(root)) compileModule(rel, fs.readFileSync(path.join(root, rel), "utf8"));
      await refresh();
    },
    resolveId(id) {
      if (id === CSS_IMPORT || id === CSS_ID) return CSS_ID;
      if (id === ENTRY_PATH || id === ISLANDS_PATH) return id;
      return null;
    },
    async load(id) {
      if (id === CSS_ID) {
        if (stale) await refresh();
        return css;
      }
      if (id === ISLANDS_PATH)
        return islandsCode(
          routesFiles().map((f) => ({ path: f, source: fs.readFileSync(path.join(root, f), "utf8") })),
        );
      if (id !== ENTRY_PATH) return null;
      const d = deployable();
      if (d === undefined)
        throw new Error(`keel: ${ENTRY_PATH} needs a client deployable in topology.ts, or KEEL_DEPLOYABLE naming one`);
      if (!d.client) return RESUME_ENTRY;
      return entryCode(
        routesFiles().map((f) => `/${f}`),
        CSS_IMPORT,
      );
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
      if (rel !== null && change.event === "delete" && modules.delete(rel)) flush();
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
