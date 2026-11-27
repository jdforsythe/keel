import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { contractCallers } from "@keel/compiler";
import type { SourceFile } from "../../types/SourceFile.ts";
import { canonicalJson } from "../canonicalJson.ts";
import { hashOf } from "../hashOf.ts";
import { isRecord } from "../isRecord.ts";
import type { Evaluation } from "./Evaluation.ts";
import type { Work } from "./Work.ts";
import { cacheInputs } from "./cacheInputs.ts";
import { cacheRead } from "./cacheRead.ts";
import { cacheWrite } from "./cacheWrite.ts";
import { evaluateTree } from "./evaluateTree.ts";

/** A file whose evaluation can give a route or a contract: a route table, a contract, or `topology.ts` placing modules. */
const EVALUATED = /^(?:modules\/[^/]+\/(?:routes\.tsx?|[^/]+\.contract\.ts)|topology\.ts)$/;
/** The bytes of a `.keel/` view for `data` (k.compiler Artifacts). */
const artifactText = (data: unknown): string => `${canonicalJson({ data, hash: hashOf(data) })}\n`;
const EMPTY_SURFACE = { version: 3, contracts: {}, stores: {} };

/** The surface data with each contract's `callers` read statically from the project's files (`contractCallers`). */
function withCallers(surface: Readonly<Record<string, unknown>>, files: readonly SourceFile[]): unknown {
  const callers = contractCallers(files);
  const contracts = isRecord(surface.contracts) ? surface.contracts : {};
  const filled = Object.fromEntries(
    Object.entries(contracts).map(([m, c]) => [m, isRecord(c) ? { ...c, callers: [...(callers[m] ?? [])].sort() } : c]),
  );
  return { ...surface, contracts: filled };
}

/**
 * The evaluated views of the project at `root` (k.derived Derivations): the bytes of `routes.json` (from its evaluated
 * manifests) and `surface.json`, and the evaluation's problem lines. `files` are the project's root-relative files:
 * their code paths key the cache, and the contracts' `callers` are read from them. With `<root>/node_modules`, the
 * evaluation is kept in `node_modules/.cache/keel/derived/` and taken from it while every input it loaded is unchanged
 * (`cacheRead`; `work.cached`); else, or on a miss, it runs once (`evaluateTree`; `work.evaluated`) and, with the
 * folder, is stored. A project with no route table, contract or `topology.ts` evaluates nothing: an empty surface.
 * `held()` tells whether every input the derivation rests on still has the bytes it had, so a writer can skip a
 * view when one changed during the run.
 */
export async function deriveEvaluated(
  root: string,
  files: readonly SourceFile[],
  codePaths: readonly string[],
  work: Work,
): Promise<{ routes: string; surface: string; problems: readonly string[]; held: () => boolean }> {
  if (!codePaths.some((p) => EVALUATED.test(p)))
    return { routes: artifactText({}), surface: artifactText(EMPTY_SURFACE), problems: [], held: () => true };
  const real = realpathSync(root);
  const cache = existsSync(join(real, "node_modules"))
    ? join(real, "node_modules", ".cache", "keel", "derived")
    : undefined;
  const hit: Evaluation | undefined = cache === undefined ? undefined : cacheRead(cache, real, codePaths);
  let e: Evaluation;
  if (hit !== undefined) {
    work.cached += 1;
    e = hit;
  } else {
    work.evaluated += 1;
    try {
      e = await evaluateTree(real);
    } catch (thrown) {
      // An evaluation that cannot run (a bundle that does not resolve, an evaluator failure) gives no view: its first
      // line is the problem, with its own code when it carries one, else E1049 (k.compiler Build-time evaluation).
      // esbuild's message starts `Build failed with 1 error:`; the line after it names the file and the error.
      const lines = (thrown instanceof Error ? thrown.message : String(thrown))
        .split("\n")
        .filter((l) => l.trim() !== "");
      const line = lines[0]?.startsWith("Build failed") === true ? (lines[1] ?? lines[0]) : lines[0];
      const text = (line ?? "build-time evaluation failed").trim();
      const problem = /^E\d{4} /.test(text) ? text : `E1049 build-time evaluation: ${text}`;
      return { routes: artifactText({}), surface: artifactText(EMPTY_SURFACE), problems: [problem], held: () => true };
    }
  }
  const inputs = cacheInputs(real, e.inputs);
  if (hit === undefined && cache !== undefined && e.problems.length === 0)
    cacheWrite(cache, real, codePaths, inputs, e);
  const loaded = e.inputs;
  const held = (): boolean => JSON.stringify(cacheInputs(real, loaded)) === JSON.stringify(inputs);
  return {
    routes: artifactText(e.routes),
    surface: artifactText(withCallers(e.surface, files)),
    problems: e.problems,
    held,
  };
}
