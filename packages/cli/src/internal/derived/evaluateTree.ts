import { fileURLToPath } from "node:url";
import { entryDependency } from "@keel/compiler/internal/entry/entryDependency";
import { isRecord } from "../isRecord.ts";
import type { Evaluation } from "./Evaluation.ts";

/** A kernel internal the evaluation loads: the project's package, else the CLI's own dependency (`entryDependency`). */
const kernel = (id: string, root: string): string => entryDependency(id, root, import.meta.url) ?? id;
/** The module the evaluation's entry reads the surface with, inside the evaluator (`surfaceRead`). */
const READER = fileURLToPath(
  new URL(`./surfaceRead${import.meta.url.endsWith(".ts") ? ".ts" : ".js"}`, import.meta.url),
);

/**
 * The one evaluation of a project's evaluated views (k.derived Derivations), returned as data only: `routes.json`'s
 * entries, the surface without its callers (k.compat Surface: `contracts` with `callers` empty, `stores`), the
 * Keel-coded problem lines (E1000, E1006, E1550, ...), the absolute path of every file it loaded, and what its code
 * asked of the file system and `process.env` while it ran, the store factories included. One esbuild bundle of the
 * contracts, route tables and store factories runs in an evaluator (`evaluateViews` of `@keel/compiler/routes`, loaded
 * only here; k.evaluator), which reads the bindings with the bundle's own `@keel/router/internal` and the stores with
 * its `@keel/store/internal` (`surfaceRead`). Nothing of the project runs in this process. An aborted `signal` ends it.
 */
export async function evaluateTree(root: string, signal?: AbortSignal): Promise<Evaluation> {
  const { evaluateViews } = await import("@keel/compiler/routes");
  const internals = {
    router: kernel("@keel/router/internal", root),
    store: kernel("@keel/store/internal", root),
    reader: READER,
  };
  const r = await evaluateViews(root, internals, signal);
  const surface = isRecord(r.surface) ? r.surface : { version: 3, contracts: {}, stores: {} };
  const asked = r.observe();
  return {
    routes: r.routes,
    surface,
    problems: [...new Set(r.problems)],
    inputs: r.inputs,
    reads: asked.reads,
    probes: asked.probes,
    env: asked.env,
    envListed: asked.envListed,
  };
}
