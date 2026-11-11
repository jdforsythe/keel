import { parseTopology } from "@keel/compiler";

/**
 * Binary only: `keel build`'s `routes.json` for a project whose every deployable is `node`, so no build writes `.keel/`
 * (the project's own and the first `client` deployable's do). `buildRoutes` (`@keel/compiler/routes`, loaded only here) evaluates
 * the manifests and writes the file with the Vite plugin's writer; its Keel-coded `notes` (a rewritten file is W1005,
 * E1006 ...) go to stderr and leave the exit code alone. A rejected evaluation (E1000, E1049) is code 1 with its message.
 */
export async function routesRun(
  cwd: string,
  topologySource: string | undefined,
): Promise<{ code: number; notes: string[] }> {
  const all = topologySource === undefined ? [] : Object.values(parseTopology(topologySource).topology);
  if (all.length === 0 || all.some((d) => d.adapter !== "node")) return { code: 0, notes: [] };
  try {
    const { buildRoutes } = await import("@keel/compiler/routes");
    return { code: 0, notes: (await buildRoutes(cwd)).notes };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: 1, notes: [`${message.split("\n")[0] ?? ""}\n`] };
  }
}
