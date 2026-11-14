import { deployFiles } from "../deployFiles.ts";
import type { Writes } from "./Writes.ts";
import { readManifest } from "./readManifest.ts";
import { topologyOf } from "./topologyOf.ts";

const CI = ".github/workflows/ci.yml";
/** A path the deploy generator writes: a Dockerfile, the compose file, or a shell file (not Cargo's `Cargo.lock`). */
const DEPLOY =
  /^deploy\/(?:[^/]+\/(?:Dockerfile|capacitor\/capacitor\.config\.json|tauri\/(?:Cargo\.toml|build\.rs|src\/(?:main|lib)\.rs|capabilities\/default\.json))|compose\.yaml)$/;
const TAURI_CONF = /^deploy\/[^/]+\/tauri\/tauri\.conf\.json$/;

/** `package.json`'s `version` and its name as a crate name (scope dropped, other characters `-`). */
function packageFacts(text: string | undefined): { version: string | undefined; crate: string | undefined } {
  let pkg: unknown;
  try {
    pkg = JSON.parse(text ?? "null");
  } catch {
    pkg = null;
  }
  const field = (k: string): unknown => (typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, k) : undefined);
  const version = field("version");
  const name = field("name");
  const crate =
    typeof name === "string"
      ? name
          .replace(/^@[^/]*\//, "")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-")
          .replace(/^[^a-z]+/, "")
      : "";
  return { version: typeof version === "string" ? version : undefined, crate: crate === "" ? undefined : crate };
}

/**
 * Writes that bring the generated deploy files of `files` in line with its `topology.ts`: path -> text, or null for
 * a deploy file no deployable needs. The CI workflow is kept when the tree has one; `deploy/` files when `always`,
 * when the tree has `turbo.json` (a project outside the Keel monorepo) or when it already holds a `deploy/` file.
 * A deployable's CI job runs on its modules and those they dep on, transitively (`modules/<id>/module.ts` `deps`).
 * `tauri.conf.json` is written and removed only with `policy`, the content security policy of a `client` document.
 * Empty without a readable `topology.ts`.
 */
export function deployWrites(files: ReadonlyMap<string, string>, always = false, policy?: string): Writes {
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
      return [n, { ...d, modules: [...reach] }];
    }),
  );
  const want = deployFiles(built, { ci, ...packageFacts(files.get("package.json")), policy });
  const paths = [...files.keys()];
  const keep = always || files.has("turbo.json") || paths.some((p) => p.startsWith("deploy/"));
  for (const [p, v] of want) if (p === CI || keep) out.set(p, v);
  const stale = (p: string): boolean => DEPLOY.test(p) || (policy !== undefined && TAURI_CONF.test(p));
  if (keep) for (const p of paths) if (stale(p) && !want.has(p)) out.set(p, null);
  return out;
}
