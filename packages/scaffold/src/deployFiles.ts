import { capacitorConfig } from "./templates/capacitorConfig.ts";
import { cargoToml } from "./templates/cargoToml.ts";
import { ciWorkflow } from "./templates/ciWorkflow.ts";
import { composeYaml } from "./templates/composeYaml.ts";
import { dockerfile } from "./templates/dockerfile.ts";
import { tauriBuildRs } from "./templates/tauriBuildRs.ts";
import { tauriCapability } from "./templates/tauriCapability.ts";
import { tauriConf } from "./templates/tauriConf.ts";
import { tauriLibRs } from "./templates/tauriLibRs.ts";
import { tauriMainRs } from "./templates/tauriMainRs.ts";
import type { DeployTopology } from "./types/DeployTopology.ts";

/**
 * The generated deploy files of a project (k.deploy Deploy files, k.shell Files), path -> text:
 * `deploy/<name>/Dockerfile` per `node` deployable (per its `storage`) and `deploy/compose.yaml` when there is one;
 * per `client` deployable declaring a shell, `deploy/<name>/capacitor/capacitor.config.json` or the
 * `deploy/<name>/tauri/` files (`tauri.conf.json` only with `project.policy`, the deployable's content security
 * policy); plus `.github/workflows/ci.yml` when `project.ci` (a project outside the Keel monorepo). `project.version`
 * is the app's `package.json` version (default `0.0.0`), `project.crate` the Tauri crate name (default `app`);
 * with `project.identity` (the project has `identity.ts`) the Tauri files hold the plugins of k.return. Pure; equal
 * input gives byte-identical output, whatever the order of deployables or modules in `topology`.
 */
export function deployFiles(
  topology: DeployTopology,
  project: {
    readonly ci: boolean;
    readonly version?: string | undefined;
    readonly crate?: string | undefined;
    readonly policy?: string | undefined;
    readonly identity?: boolean | undefined;
  },
): Map<string, string> {
  const names = Object.keys(topology).sort();
  const nodes = names.filter((n) => topology[n]?.adapter === "node");
  const version = project.version ?? "0.0.0";
  const files: [string, string][] = [];
  if (project.ci) files.push([".github/workflows/ci.yml", ciWorkflow(topology, project.crate ?? "app")]);
  if (nodes.length > 0) files.push(["deploy/compose.yaml", composeYaml(nodes, (n) => topology[n]?.storage ?? "file")]);
  for (const n of nodes) files.push([`deploy/${n}/Dockerfile`, dockerfile(n, topology[n]?.storage ?? "file")]);
  for (const n of names) {
    const d = topology[n];
    if (d?.adapter !== "client") continue;
    const { capacitor, tauri } = d.shells ?? {};
    if (capacitor !== undefined)
      files.push([`deploy/${n}/capacitor/capacitor.config.json`, capacitorConfig(capacitor)]);
    if (tauri === undefined) continue;
    const at = `deploy/${n}/tauri/`;
    if (project.policy !== undefined) files.push([`${at}tauri.conf.json`, tauriConf(tauri, version, project.policy)]);
    files.push(
      [`${at}Cargo.toml`, cargoToml(project.crate ?? "app", version, project.identity)],
      [`${at}build.rs`, tauriBuildRs()],
      [`${at}src/main.rs`, tauriMainRs()],
      [`${at}src/lib.rs`, tauriLibRs(project.identity)],
      [`${at}capabilities/default.json`, tauriCapability(project.identity)],
    );
  }
  return new Map(files);
}
