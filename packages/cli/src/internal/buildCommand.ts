import { compile, isSourcePath, projectDirs } from "@keel/compiler";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { Outcome } from "./Outcome.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { codeFiles } from "./codeFiles.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { projectTopology } from "./projectTopology.ts";
import { summary } from "./summary.ts";

/** Artifacts `compile` derives on its own; `routes.json` needs `routes.ts` evaluated, which the Vite plugin does. */
const ARTIFACTS = ["a11y.json", "deps.json", "ids.json", "styles.json"] as const;

/**
 * `keel build`: compile every app source of the root project (`isSourcePath`, the rule the Vite plugin and `keel
 * check` share, rfc:0050; nested projects by `projectDirs`, rfc:0059) with `@keel/compiler`. Diagnostics flow through unchanged; with no error, the `.keel/` artifacts
 * (`{ data, hash }`, sorted keys, read-only) are returned as writes. Bundling is Vite's: the binary runs `vite build` when `vite.config.ts` exists.
 */
export function buildCommand(io: Io): Outcome {
  const project = projectFiles(io);
  // Only the root project's files: a nested project (`projectDirs`, the rule `keel check` groups by) builds itself.
  const dirs = projectDirs(project);
  const files = codeFiles(io, undefined).filter(
    (f) => isSourcePath(f.path) && dirs.find((d) => f.path.startsWith(d)) === "",
  );
  const topology = projectTopology(project);
  const r = compile(files, topology === undefined ? {} : { topology });
  const diags: OutRecord[] = r.diagnostics.map((d) =>
    makeDiag(d.code, d.message, { path: d.path, line: d.line, col: d.col, see: d.see, fix: d.fix }),
  );
  const failed = diags.some((d) => typeof d.code === "string" && d.code.startsWith("E"));
  const writes = failed
    ? []
    : ARTIFACTS.map((name) => ({
        path: `.keel/${name}`,
        content: `${canonicalJson({ data: r.artifacts[name], hash: r.hashes[name] })}\n`,
        readonly: true,
      }));
  const errors = diags.filter((d) => typeof d.code === "string" && d.code.startsWith("E")).length;
  return {
    records: [...diags, summary("build", diags, { files: files.length, artifacts: writes.length, errors })],
    writes,
  };
}
