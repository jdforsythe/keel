import type { DeployTopology } from "../types/DeployTopology.ts";
import type { ShellApp } from "../types/ShellApp.ts";
import type { ShellProject } from "./ShellProject.ts";

/** The shells in the order their files and CI jobs are generated. */
const SHELLS = ["tauri", "capacitor"] as const;

/**
 * Each shell a `client` deployable of `topology` declares, as its target sees it (k.shell Shell target): deployables
 * by name, then Tauri before Capacitor.
 */
export function shellApps(
  topology: DeployTopology,
  project: ShellProject,
): { readonly shell: (typeof SHELLS)[number]; readonly app: ShellApp }[] {
  const out: { shell: (typeof SHELLS)[number]; app: ShellApp }[] = [];
  for (const deployable of Object.keys(topology).sort()) {
    const d = topology[deployable];
    if (d?.adapter !== "client") continue;
    for (const shell of SHELLS) {
      const s = d.shells?.[shell];
      if (s !== undefined)
        out.push({
          shell,
          app: { deployable, id: s.id, name: s.name, ...project, policy: project.policy?.(d.origins) },
        });
    }
  }
  return out;
}
