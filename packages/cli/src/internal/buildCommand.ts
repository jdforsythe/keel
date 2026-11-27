import { compile, isSourcePath, pathCollisions, projectDirs, serverOnlyCalls, stdArtifact } from "@keel/compiler";
import { identityDiags } from "@keel/compiler/hosting/identityDiags";
import { projectTokens } from "@keel/compiler/hosting/projectTokens";
import { hashOf } from "@keel/compiler/internal";
import { importDeps } from "@keel/compiler/std/importDeps";
import { librarySources } from "@keel/compiler/std/librarySources";
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
import { failedDist } from "./failedDist.ts";
import { hostingDiags } from "./hostingDiags.ts";
import { inWorkspace } from "./inWorkspace.ts";
import { isError } from "./isError.ts";
import { libraryManifestFiles } from "./libraryManifestFiles.ts";
import { loadShells } from "./loadShells.ts";
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
 * (`{ data, hash }`, sorted keys, read-only) are returned as writes, with `std.json` from `stdArtifact` and `schemes.json` from the evaluated tokens after the
 * stdlib `deps` are imported (E1159; its E1158 too; E1559 from `pathCollisions`; E1579 from `identityDiags`; E1558 from `serverOnlyCalls`; E1552, E1565 and E1566 from `hostingDiags`; check's W1012), and the deploy files of `topology.ts` (k.deploy; the CI workflow unless the project is an app inside a workspace).
 * With no error and a host `Io.build`, the writes are applied and the disk half runs (`routes.json`, `surface.json`,
 * the Vite builds), its diagnostics, stderr and exit code joining the result: `keel build` and MCP `build` run one path.
 * The declared shells' targets load first (`shellTargets`). `--target` (k.shell Build) then runs `shellPlan`'s checks, and any diagnostic there ends the build with nothing
 * written; after a clean disk half the host (`Io.shell`) builds the shell, and the trailer names each artifact.
 * `refresh` (k.scaffold Refresh) runs the same steps with `Io.refresh` as the disk half: no bundle, nothing under `dist/`.
 * A build failing with E1510 or E1511, at any step, leaves no `dist/<name>/` of the deployable serving the entry, an
 * earlier build's or this run's part-written one (`failedDist`, `Io.discard`; k.api Rules).
 */
export async function buildCommand(io: Io, input: Input = {}, refresh = false): Promise<Outcome> {
  const project = projectFiles(io);
  const out = await steps(io, project, input, refresh);
  const failed = out.records.filter((r) => isError(r));
  if (!refresh && failed.length > 0) {
    const dirs = failedDist(failed, projectTopology(project));
    if (dirs.length > 0) io.discard?.(dirs);
  }
  return out;
}

async function steps(
  io: Io,
  project: ReturnType<typeof projectFiles>,
  input: Input,
  refresh: boolean,
): Promise<Outcome> {
  const policy = await shellPolicy(io.cwd, project);
  const targets = await loadShells(io.cwd, project, policy);
  // Behind its own entry, loaded only for `--target` (`@keel/cli` size budget).
  const host = input.target === undefined ? undefined : await io.shell?.();
  const pre =
    input.target === undefined
      ? { diags: [], plan: undefined }
      : (await import("@keel/cli/shell")).shellPlan(input, io.env ?? {}, io.cwd, targets, host?.probe);
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
  // The artifacts derive from the app's sources and its libraries' files (k.library In an app), as the plugin's do.
  const r = compile([...files, ...librarySources(io.cwd)], topology === undefined ? {} : { topology });
  const std = stdArtifact(files);
  // The tokens' color schemes, for a node deployable's first paint (k.schemes); no `tokens.ts`, one scheme.
  const evaluated = await projectTokens(io.cwd);
  const schemes = { schemes: evaluated?.ok === true ? [...evaluated.schemes] : ["light"] };
  const paths = [
    ...identityDiags(project, io.cwd, true),
    ...(topology === undefined
      ? []
      : [...pathCollisions(files, topology, io.cwd), ...serverOnlyCalls(files, topology)]),
  ];
  const diags: OutRecord[] = [
    // W1012 (k.head Document source): check found a project `index.html`, which the build ignores too.
    ...checked.filter((r) => r.kind === "diag" && r.code === "W1012"),
    ...[...loaded, ...r.diagnostics, ...std.diagnostics, ...paths].map((d) =>
      makeDiag(d.code, d.message, { path: d.path, line: d.line, col: d.col, see: d.see, fix: d.fix }),
    ),
    ...(topology === undefined
      ? []
      : hostingDiags(topology, io.env ?? {}, project.find((f) => f.path === "topology.ts")?.source)),
  ];
  const failed = diags.some(isError);
  // The libraries' manifests join the tree: their `env` names reach `deploy/compose.yaml` (k.server-deps Environment).
  const deployTree = [...project, ...libraryManifestFiles(io.cwd, project)];
  const deploy = failed ? [] : deployBuildWrites(deployTree, !inWorkspace(io), policy, targets.shells);
  const writes: Write[] = failed
    ? []
    : [
        ...[
          ...ARTIFACTS.map((name) => ({ path: `.keel/${name}`, data: r.artifacts[name], hash: r.hashes[name] })),
          { path: ".keel/std.json", data: std.data, hash: std.hash },
          { path: ".keel/schemes.json", data: schemes, hash: hashOf(schemes) },
        ].map(({ path, data, hash }) => ({ path, content: `${canonicalJson({ data, hash })}\n`, readonly: true })),
        ...deploy,
      ];
  const artifacts = failed
    ? 0
    : ARTIFACTS.length + 2 + (topology === undefined ? 0 : deployArtifactCount(project, deploy, targets.paths));
  // One trailer, after every step has settled; a step that exits non-zero without a diagnostic still counts one error.
  const done = (all: readonly OutRecord[], code = 0): OutRecord[] => [
    ...all,
    summary("build", all, {
      files: files.length,
      artifacts,
      errors: Math.max(all.filter(isError).length, code === 0 ? 0 : 1),
    }),
  ];
  const half = refresh ? io.refresh : io.build;
  if (failed || half === undefined) return { records: done(diags), writes };
  // The disk half reads what the engine wrote, so the writes land first (`Io.build`).
  io.apply?.(writes);
  const post = await half(io.cwd);
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
            ["build", ...plan.apps.flatMap((a, i) => [a.deployable, plan.target, sh.artifacts[i] ?? ""])].join(" "),
            all,
            {},
          ),
        ]
      : done(all, sh.code);
  return { records, writes: [], stderr: post.stderr + sh.stderr, code: Math.max(post.code, sh.code) };
}
