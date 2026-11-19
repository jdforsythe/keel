import { compile, isSourcePath, pathCollisions, projectDirs, serverOnlyCalls, stdArtifact } from "@keel/compiler";
import { identityDiags } from "@keel/compiler/hosting/identityDiags";
import { importDeps } from "@keel/compiler/std/importDeps";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { Write } from "../types/Write.ts";
import type { Outcome } from "./Outcome.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { checkCommand } from "./checkCommand.ts";
import { codeFiles } from "./codeFiles.ts";
import { deployArtifactCount } from "./deployArtifactCount.ts";
import { deployBuildWrites } from "./deployBuildWrites.ts";
import { hostingDiags } from "./hostingDiags.ts";
import { inWorkspace } from "./inWorkspace.ts";
import { isError } from "./isError.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { projectTopology } from "./projectTopology.ts";
import { shellPolicy } from "./shellPolicy.ts";
import { summary } from "./summary.ts";

/** Artifacts `compile` derives on its own (plus `std.json`); `routes.json` needs `routes.ts` evaluated, which the Vite plugin does. */
const ARTIFACTS = ["a11y.json", "deps.json", "ids.json", "styles.json"] as const;

/**
 * `keel build`: run `keel check` and stop on an error (E1005 aside), then compile every app source of the root project (`isSourcePath`, the rule the Vite plugin and `keel
 * check` share; nested projects by `projectDirs`) with `@keel/compiler`. Diagnostics flow through unchanged; with no error, the `.keel/` artifacts
 * (`{ data, hash }`, sorted keys, read-only) are returned as writes, with `std.json` from `stdArtifact` after the
 * stdlib `deps` are imported (E1159; its E1158 too; E1559 from `pathCollisions`; E1579 from `identityDiags`; E1558 from `serverOnlyCalls`; E1552, E1565 and E1566 from `hostingDiags`), and the deploy files of `topology.ts` (k.deploy; the CI workflow unless the project is an app inside a workspace).
 * With no error and a host `Io.build`, the writes are applied and the disk half runs (`routes.json`, `surface.json`,
 * the Vite builds), its diagnostics, stderr and exit code joining the result: `keel build` and MCP `build` run one path.
 * `--target` (k.shell Build) first runs `shellPlan`'s checks, and any diagnostic there ends the build with nothing
 * written; after a clean disk half the host (`Io.shell`) builds the shell, and the trailer names each artifact.
 */
export async function buildCommand(io: Io, input: Input = {}): Promise<Outcome> {
  const project = projectFiles(io);
  // Behind its own entry, loaded only for `--target` (`@keel/cli` size budget).
  const host = input.target === undefined ? undefined : await io.shell?.();
  const pre =
    input.target === undefined
      ? { diags: [], plan: undefined }
      : (await import("@keel/cli/shell")).shellPlan(input, project, io.env ?? {}, io.cwd, host?.probe);
  if (pre.diags.length > 0)
    return { records: [...pre.diags, summary("build", pre.diags, { errors: pre.diags.length })], writes: [] };
  // `keel check` first (k.boundary Build gate): an error stops the build with its records and nothing written. E1005,
  // generated output that differs from its sources, is what the build rewrites.
  const checked = await checkCommand({}, io);
  if (checked.some((r) => r.kind === "diag" && r.code !== "E1005" && isError(r)))
    return { records: checked, writes: [] };
  // Only the root project's files: a nested project (`projectDirs`, the rule `keel check` groups by) builds itself.
  const dirs = projectDirs(project);
  const files = codeFiles(io, undefined).filter(
    (f) => isSourcePath(f.path) && dirs.find((d) => f.path.startsWith(d)) === "",
  );
  const topology = projectTopology(project);
  const loaded = await importDeps(io.cwd, files);
  const r = compile(files, topology === undefined ? {} : { topology });
  const std = stdArtifact(files);
  const paths = [
    ...identityDiags(project, io.cwd, true),
    ...(topology === undefined
      ? []
      : [...pathCollisions(files, topology, io.cwd), ...serverOnlyCalls(files, topology)]),
  ];
  const diags: OutRecord[] = [
    ...[...loaded, ...r.diagnostics, ...std.diagnostics, ...paths].map((d) =>
      makeDiag(d.code, d.message, { path: d.path, line: d.line, col: d.col, see: d.see, fix: d.fix }),
    ),
    ...(topology === undefined
      ? []
      : hostingDiags(topology, io.env ?? {}, project.find((f) => f.path === "topology.ts")?.source)),
  ];
  const failed = diags.some(isError);
  const deploy = failed ? [] : deployBuildWrites(project, !inWorkspace(io), await shellPolicy(io.cwd, project));
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
  // One trailer, after every step has settled; a step that exits non-zero without a diagnostic still counts one error.
  const done = (all: readonly OutRecord[], code = 0): OutRecord[] => [
    ...all,
    summary("build", all, {
      files: files.length,
      artifacts,
      errors: Math.max(all.filter(isError).length, code === 0 ? 0 : 1),
    }),
  ];
  if (failed || io.build === undefined) return { records: done(diags), writes };
  // The disk half reads what the engine wrote, so the writes land first (`Io.build`).
  io.apply?.(writes);
  const post = await io.build(io.cwd);
  const plan = pre.plan;
  if (plan === undefined || post.code !== 0 || post.diagnostics.some(isError) || host === undefined)
    return {
      records: done([...diags, ...post.diagnostics], post.code),
      writes: [],
      stderr: post.stderr,
      code: post.code,
    };
  const sh = host.build(io.cwd, plan);
  const all = [...diags, ...post.diagnostics, ...sh.diagnostics];
  const records =
    sh.code === 0 && !all.some(isError)
      ? [
          ...all,
          summary(
            ["build", ...plan.deployables.flatMap((n, i) => [n, plan.target, sh.artifacts[i] ?? ""])].join(" "),
            all,
            {},
          ),
        ]
      : done(all, sh.code);
  return { records, writes: [], stderr: post.stderr + sh.stderr, code: Math.max(post.code, sh.code) };
}
