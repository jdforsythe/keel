import fs from "node:fs";
import path from "node:path";
import type { Observed } from "./internal/Observed.ts";
import { evaluateProject } from "./internal/evaluateProject.ts";
import { listSources } from "./internal/listSources.ts";
import { parseTopology } from "./internal/parseTopology.ts";
import { projectManifests } from "./internal/projectManifests.ts";
import { stdContract } from "./std/stdContract.ts";
import { stdRoutes } from "./std/stdRoutes.ts";
import type { RouteEntry } from "./types/RouteEntry.ts";

const CONTRACT = /^modules\/([^/]+)\/([^/]+)\.contract\.ts$/;
const ROUTES = /^modules\/[^/]+\/routes\.tsx?$/;

/**
 * The one evaluation of a project's evaluated views (k.derived Derivations): `routes.json`'s entries, from the routes
 * manifests its own build merges (`projectManifests` of `root`'s `topology.ts`, read statically), and the surface's
 * values (k.compat Surface), from each app `modules/<m>/<m>.contract.ts` and `modules/<m>/routes.ts`, and each placed
 * stdlib module's package `./contract` and `./routes`. One esbuild bundle (`evaluateProject`) runs once in an
 * evaluator (k.evaluator); `internals` are the specifiers of `@keel/router/internal` and `@keel/store/internal` it
 * reads bindings and store shapes with and `reader`, the file whose `surfaceRead` turns them into data there (none:
 * no surface is evaluated); `surface` is that data. `inputs` is every file the bundle loaded, absolute; `observe()` what its
 * code asked of the file system and the environment so far (`Observed`). `problems` are Keel-coded lines (E1000, E1006,
 * E1807, ...). Rejects when the evaluation gives no result (E1048, E1049, a refusal that ended it), and with the
 * signal's reason when `signal` aborts it.
 */
export async function evaluateViews(
  root: string,
  internals?: { readonly router: string; readonly store: string; readonly reader: string },
  signal?: AbortSignal,
): Promise<{
  routes: Record<string, RouteEntry>;
  problems: string[];
  inputs: string[];
  observe: () => Observed;
  surface: unknown;
}> {
  const topologyFile = path.join(root, "topology.ts");
  const topology = fs.existsSync(topologyFile)
    ? parseTopology(fs.readFileSync(topologyFile, "utf8")).topology
    : undefined;
  const files = listSources(root);
  const routesFiles = projectManifests(topology, files, root);
  const placed = [...new Set(Object.values(topology ?? {}).flatMap((d) => d.modules))];
  const std = (find: typeof stdRoutes): string[] =>
    placed.flatMap((m) => {
      const at = find(root, m);
      return at === undefined ? [] : [at[0]];
    });
  const own = (f: string): boolean => {
    const m = CONTRACT.exec(f);
    return m !== null && m[1] === m[2];
  };
  const surface =
    internals === undefined
      ? undefined
      : {
          contracts: [...files.filter(own), ...std(stdContract)],
          tables: [...files.filter((f) => ROUTES.test(f)), ...std(stdRoutes)],
          ...internals,
        };
  const r = await evaluateProject({ root, tokensFile: undefined, routesFiles, usages: [], surface, signal });
  const none: Observed = { reads: [], probes: [], env: [], envListed: false };
  return {
    routes: r.routes,
    problems: r.problems,
    inputs: r.inputs ?? [],
    observe: r.observe ?? (() => none),
    surface: r.surface,
  };
}
