import { pathCollisions, serverOnlyCalls } from "@keel/compiler";
import { identityDiags } from "@keel/compiler/hosting/identityDiags";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { agentDrift } from "./agentDrift.ts";
import { baseInput } from "./baseInput.ts";
import { codeFiles } from "./codeFiles.ts";
import { deployFreshness } from "./deployFreshness.ts";
import { loadShells } from "./loadShells.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { projectTopology } from "./projectTopology.ts";
import { runCheck } from "./runCheck.ts";
import { shellPolicy } from "./shellPolicy.ts";
import { summary } from "./summary.ts";

/**
 * `keel check [paths]`: k.check diagnostics over the code files and `.keel/*.json` artifacts under `paths` (a
 * tampered, forged, or stale artifact is E1005, rfc:0037, rfc:0050; stdlib `deps` imported first, E1159, rfc:0066), then a summary that counts every code (`--code` filters display only).
 * `--base <surface.json>` hands the deployed surface to the k.compat pass (E1562); no usable surface there is W1568.
 * E1559 (one path in two deployables) and E1558 (server-only route work a `client` or `static` deployable serves) come
 * from `pathCollisions` and `serverOnlyCalls`, the functions `keel build` calls; E1579 for a route under the identity
 * source's `handle.path`, from `identityDiags`. Each declared shell's target loads first (`shellTargets`: E1159, E1585),
 * and each plugin it names that `package.json` lacks is one E1572, once per plugin (k.shell Plugins).
 * W1356 for a stale agent file, where `AGENTS.md` holds the Keel block.
 * Run over every code file, it checks the files of the app's libraries too (`runCheck`, k.library In an app).
 */
export async function checkCommand(input: Input, io: Io): Promise<OutRecord[]> {
  const files = codeFiles(io, input.paths, true);
  const base = baseInput(input, io);
  const project = projectFiles(io);
  // Without paths, or with paths that cover every code file, the app's libraries are checked too (k.library In an app).
  const whole = files.length === codeFiles(io, undefined, true).length;
  const checked = await runCheck(io.cwd, files, project, base.value, whole);
  const topology = projectTopology(project);
  const policy = await shellPolicy(io.cwd, project);
  const loaded = await loadShells(io.cwd, project, policy);
  const paths = [
    ...identityDiags(project, io.cwd),
    ...(topology === undefined
      ? []
      : [...pathCollisions(project, topology, io.cwd), ...serverOnlyCalls(project, topology)]),
  ].map((d) => makeDiag(d.code, d.message, { path: d.path, line: d.line, col: d.col, see: d.see }));
  const diags = [
    ...(base.warn === undefined ? [] : [base.warn]),
    ...checked,
    ...paths,
    ...loaded.diags,
    ...loaded.needs.filter((n, i, all) => all.findIndex((x) => x.plugin === n.plugin) === i).map((n) => n.diag),
    ...deployFreshness(project, policy, loaded.shells),
    ...(await agentDrift(project)),
  ];
  const errors = diags.filter((d) => d.code.startsWith("E")).length;
  const warnings = diags.filter((d) => d.code.startsWith("W")).length;
  return [...diags, summary("check", diags, { files: files.length, errors, warnings })];
}
