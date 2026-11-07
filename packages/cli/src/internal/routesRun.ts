import { viteTargets } from "./viteTargets.ts";

/**
 * Binary only: `keel build`'s `routes.json` for a project whose own `vite build` never runs, every deployable `node`
 * (`viteTargets` has no project build; rfc:0059). `buildRoutes` (`@keel/compiler/routes`, loaded only here) evaluates
 * the manifests and writes the file with the Vite plugin's writer; its Keel-coded `notes` (a rewritten file is W1005,
 * E1006 ...) go to stderr and leave the exit code alone. A rejected evaluation (E1000, E1049) is code 1 with its message.
 */
export async function routesRun(
  cwd: string,
  topologySource: string | undefined,
): Promise<{ code: number; notes: string[] }> {
  if (topologySource === undefined || viteTargets(topologySource).includes(undefined)) return { code: 0, notes: [] };
  try {
    const { buildRoutes } = await import("@keel/compiler/routes");
    return { code: 0, notes: (await buildRoutes(cwd)).notes };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: 1, notes: [`${message.split("\n")[0] ?? ""}\n`] };
  }
}
