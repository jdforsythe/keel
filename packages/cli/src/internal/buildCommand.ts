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
import { frozenRun } from "./derived/frozenRun.ts";
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
 */
export async function buildCommand(io: Io, input: Input = {}, refresh = false): Promise<Outcome> {
  const project = projectFiles(io);
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
  // `keel check` first (k.boundary Build gate): an error stops the build with its records and nothing written. Not
  // frozen, the check has kept the derived views (k.derived Refresh) and an E1005 left is a file the build removes from
  // nothing; frozen, a differing view is E1005 and stops the build too, since nothing may be written.
  const frozen = frozenRun(input.frozen, io.env);
  let refreshViews: () => readonly OutRecord[] = () => [];
  // An evaluation problem (E1006, E1049, ...) fails the build after its Vite builds have run, as a failed step does.
  let late: readonly OutRecord[] = [];
  const run = await checkCommand(frozen ? { frozen: true } : {}, io, (r, problems) => {
    refreshViews = r;
    late = problems;
  });
  const checked = run.filter((r) => r.kind !== "summary");
  const gate = checked.filter((r) => !late.includes(r));
  if (gate.some((r) => r.kind === "diag" && (frozen || r.code !== "E1005") && isError(r)))
    return { records: [...checked, summary("build", checked, { errors: checked.filter(isError).length })], writes: [] };
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
  // The views the check derived are written only by a build that goes on (k.derived Refresh): a failing one writes nothing.
  if (!failed && !frozen) diags.push(...refreshViews());
  diags.push(...late);
  // The libraries' manifests join the tree: their `env` names reach `deploy/compose.yaml` (k.server-deps Environment).
  const deployTree = [...project, ...libraryManifestFiles(io.cwd, project)];
  const deploy = failed ? [] : deployBuildWrites(deployTree, !inWorkspace(io), policy, targets.shells);
  // An engine run over given files (no `Io.load`) keeps no views in its check: the build returns them as writes.
  const views =
    io.load !== undefined
      ? []
      : [
          ...ARTIFACTS.map((name) => ({ path: `.keel/${name}`, data: r.artifacts[name], hash: r.hashes[name] })),
          { path: ".keel/std.json", data: std.data, hash: std.hash },
          { path: ".keel/schemes.json", data: schemes, hash: hashOf(schemes) },
        ].map(({ path, data, hash }) => ({ path, content: `${canonicalJson({ data, hash })}\n`, readonly: true }));
  const writes: Write[] = failed || frozen ? [] : [...views, ...deploy];
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
  const { refresh: again, build: bundle } = io;
  const half = refresh
    ? again === undefined
      ? undefined
      : () => again(io.cwd)
    : bundle === undefined
      ? undefined
      : () => bundle(io.cwd, frozen);
  if (failed || half === undefined) return { records: done(diags), writes };
  // The disk half reads what the engine wrote, so the writes land first (`Io.build`).
  io.apply?.(writes);
  const ran = await half();
  // A Vite build evaluates the routes again: a line for a file the check's evaluation already reported is dropped.
  const same = (d: OutRecord): boolean =>
    late.some(
      (l) =>
        l.kind === "diag" &&
        d.kind === "diag" &&
        l.code === d.code &&
        (l.path === d.path ||
          (typeof l.path === "string" && typeof d.path === "string" && d.path.endsWith(`/${l.path}`))),
    );
  const post = { ...ran, diagnostics: ran.diagnostics.filter((d) => !same(d)) };
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
