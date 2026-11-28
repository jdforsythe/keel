import type { Origins } from "@keel/compiler";
import { deployFiles } from "../deployFiles.ts";
import type { DeployShells } from "../types/DeployShells.ts";
import type { Writes } from "./Writes.ts";
import { deployEnv } from "./deployEnv.ts";
import { readManifest } from "./readManifest.ts";
import { topologyOf } from "./topologyOf.ts";

const CI = ".github/workflows/ci.yml";
/** A path the deploy generator writes outside the shell folders: a Dockerfile or the compose file. */
const DEPLOY = /^deploy\/(?:[^/]+\/Dockerfile|compose\.yaml)$/;
/** A file in a shell's folder `deploy/<name>/<shell>/`. */
const SHELL_FILE = /^deploy\/([^/]+)\/(capacitor|tauri)\//;

/** A string field of `package.json` (undefined when absent or unreadable). */
function fieldOf(text: string | undefined, key: string): string | undefined {
  try {
    const pkg: unknown = JSON.parse(text ?? "null");
    const v: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, key) : undefined;
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes that bring the generated deploy files of `files` in line with its `topology.ts`: path -> text, or null for
 * a deploy file no deployable needs. The CI workflow is kept when the tree has one; `deploy/` files when `always`,
 * when the tree has `turbo.json` (a project outside the Keel monorepo) or when it already holds a `deploy/` file.
 * A deployable's CI job runs on its modules and those they dep on, transitively (`modules/<id>/module.ts` `deps`); a
 * `node` one is passed the `env` names its modules and their libraries need (`deployEnv`, k.server-deps Environment),
 * a library's manifest read at `node_modules/<name>/module.ts` of `files`. The CI workflow follows `package.json`'s
 * `packageManager`.
 * `policy` gives the content security policy of a `client` document for a deployable's declared
 * origins (k.origins). Shell files come from the targets in `shells`
 * (k.shell Files): a file of a shell folder that the target gives no deployable declaring that shell is removed, and
 * other files there (the app's own) stay. Empty without a readable `topology.ts`.
 */
export function deployWrites(
  files: ReadonlyMap<string, string>,
  always = false,
  policy?: (origins?: Origins) => string,
  shells: DeployShells = {},
): Writes {
  const out: Writes = new Map();
  const topology = topologyOf(files);
  if (topology === null) return out;
  const ci = files.has(CI);
  const deps = (m: string): readonly string[] => {
    const p = `modules/${m}/module.ts`;
    return readManifest(p, files.get(p) ?? "")?.deps ?? [];
  };
  const built = Object.fromEntries(
    Object.entries(topology).map(([n, d]) => {
      const reach = new Set(d.modules);
      for (const m of reach) for (const x of deps(m)) reach.add(x);
      return [n, { ...d, modules: [...reach], env: deployEnv(files, d.modules) }];
    }),
  );
  const pkg = files.get("package.json");
  const identity = files.has("identity.ts");
  const project = { version: fieldOf(pkg, "version") ?? "0.0.0", pkg: fieldOf(pkg, "name") ?? "", policy, identity };
  const want = deployFiles(built, { ci, ...project, shells, packageManager: fieldOf(pkg, "packageManager") });
  const paths = [...files.keys()];
  const keep = always || files.has("turbo.json") || paths.some((p) => p.startsWith("deploy/"));
  for (const [p, v] of want) if (p === CI || keep) out.set(p, v);
  // What each shell target gives a folder's deployable, declared there or not: a file the generator owns.
  const owned = new Set<string>();
  for (const p of paths) {
    const m = SHELL_FILE.exec(p);
    const name = m?.[1];
    const shell = m?.[2] === "capacitor" || m?.[2] === "tauri" ? m[2] : undefined;
    const target = shell === undefined ? undefined : shells[shell];
    if (name === undefined || shell === undefined || target === undefined || owned.has(`${name}/${shell}`)) continue;
    owned.add(`${name}/${shell}`);
    const declared = topology[name]?.shells?.[shell];
    const app = {
      deployable: name,
      id: declared?.id ?? "",
      name: declared?.name ?? "",
      ...project,
      policy: policy?.(topology[name]?.origins),
    };
    for (const f of Object.keys(target.files(app))) owned.add(`deploy/${name}/${shell}/${f}`);
  }
  const stale = (p: string): boolean => DEPLOY.test(p) || owned.has(p);
  if (keep) for (const p of paths) if (stale(p) && !want.has(p)) out.set(p, null);
  return out;
}
