import { parseTopology } from "@keel/compiler";

/**
 * Binary only: `keel build`'s `routes.json` for a project with deployables and none `client`, so no build writes `.keel/`
 * (the project's own and the first `client` deployable's do). `buildRoutes` (`@keel/compiler/routes`, loaded only here) evaluates
 * the manifests and writes the file with the Vite plugin's writer; its Keel-coded `notes` are returned (a rewritten
 * file is W1005), and an evaluation problem among them (E1006, E1807) makes code 1. A rejected evaluation (E1000,
 * E1049) is code 1 with its message, `rejected`. `always` evaluates whatever the topology holds: a refresh runs no
 * Vite build to write the file (k.scaffold Refresh).
 */
export async function routesRun(
  cwd: string,
  topologySource: string | undefined,
  always = false,
): Promise<{ code: number; notes: string[]; rejected?: true }> {
  const all = topologySource === undefined ? [] : Object.values(parseTopology(topologySource).topology);
  if (!always && (all.length === 0 || all.some((d) => d.adapter === "client"))) return { code: 0, notes: [] };
  try {
    const { buildRoutes } = await import("@keel/compiler/routes");
    const { notes } = await buildRoutes(cwd);
    return { code: notes.some((n) => /^E\d{4} /.test(n)) ? 1 : 0, notes };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: 1, notes: [`${message.split("\n")[0] ?? ""}\n`], rejected: true };
  }
}
