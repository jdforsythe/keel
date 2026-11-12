import { compile, isSourcePath, pathCollisions, projectDirs, stdArtifact } from "@keel/compiler";
import { importDeps } from "@keel/compiler/std/importDeps";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { Write } from "../types/Write.ts";
import type { Outcome } from "./Outcome.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { codeFiles } from "./codeFiles.ts";
import { deployArtifactCount } from "./deployArtifactCount.ts";
import { deployBuildWrites } from "./deployBuildWrites.ts";
import { hostingDiags } from "./hostingDiags.ts";
import { inWorkspace } from "./inWorkspace.ts";
import { isError } from "./isError.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { projectTopology } from "./projectTopology.ts";
import { summary } from "./summary.ts";

/** Artifacts `compile` derives on its own (plus `std.json`); `routes.json` needs `routes.ts` evaluated, which the Vite plugin does. */
const ARTIFACTS = ["a11y.json", "deps.json", "ids.json", "styles.json"] as const;

/**
 * `keel build`: compile every app source of the root project (`isSourcePath`, the rule the Vite plugin and `keel
 * check` share, rfc:0050; nested projects by `projectDirs`, rfc:0059) with `@keel/compiler`. Diagnostics flow through unchanged; with no error, the `.keel/` artifacts
 * (`{ data, hash }`, sorted keys, read-only) are returned as writes, with `std.json` from `stdArtifact` after the
 * stdlib `deps` are imported (E1159; its E1158 too, rfc:0066; E1559 from `pathCollisions`; E1552, E1565 and E1566 from `hostingDiags`), and the deploy files of `topology.ts` (k.deploy; the CI workflow unless the project is an app inside a workspace).
 * With no error and a host `Io.build`, the writes are applied and the disk half runs (`routes.json`, `surface.json`,
 * the Vite builds), its diagnostics, stderr and exit code joining the result: `keel build` and MCP `build` run one path.
 */
export async function buildCommand(io: Io): Promise<Outcome> {
  const project = projectFiles(io);
  // Only the root project's files: a nested project (`projectDirs`, the rule `keel check` groups by) builds itself.
  const dirs = projectDirs(project);
  const files = codeFiles(io, undefined).filter(
    (f) => isSourcePath(f.path) && dirs.find((d) => f.path.startsWith(d)) === "",
  );
  const topology = projectTopology(project);
  const loaded = await importDeps(io.cwd, files);
  const r = compile(files, topology === undefined ? {} : { topology });
  const std = stdArtifact(files);
  const paths = topology === undefined ? [] : pathCollisions(files, topology, io.cwd);
  const diags: OutRecord[] = [
    ...[...loaded, ...r.diagnostics, ...std.diagnostics, ...paths].map((d) =>
      makeDiag(d.code, d.message, { path: d.path, line: d.line, col: d.col, see: d.see, fix: d.fix }),
    ),
    ...(topology === undefined
      ? []
      : hostingDiags(topology, io.env ?? {}, project.find((f) => f.path === "topology.ts")?.source)),
  ];
  const failed = diags.some(isError);
  const deploy = failed ? [] : deployBuildWrites(project, !inWorkspace(io));
  const writes: Write[] = failed
    ? []
    : [
        ...[
          ...ARTIFACTS.map((name) => ({ path: `.keel/${name}`, data: r.artifacts[name], hash: r.hashes[name] })),
          { path: ".keel/std.json", data: std.data, hash: std.hash },
        ].map(({ path, data, hash }) => ({ path, content: `${canonicalJson({ data, hash })}\n`, readonly: true })),
        ...deploy,
      ];
  const artifacts = failed
    ? 0
    : ARTIFACTS.length + 1 + (topology === undefined ? 0 : deployArtifactCount(project, deploy));
  const done = (all: readonly OutRecord[]): OutRecord[] => [
    ...all,
    summary("build", all, { files: files.length, artifacts, errors: all.filter(isError).length }),
  ];
  if (failed || io.build === undefined) return { records: done(diags), writes };
  // The disk half reads what the engine wrote, so the writes land first (`Io.build`).
  io.apply?.(writes);
  const post = await io.build(io.cwd);
  return { records: done([...diags, ...post.diagnostics]), writes: [], stderr: post.stderr, code: post.code };
}
