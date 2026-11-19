import { topologyAst } from "./internal/topologyAst.ts";

/** The `client` deployables of `topology.ts` source `src` that declare `shell` in `shells` (k.shell), sorted by name. */
export function shellDeployables(src: string, shell: "capacitor" | "tauri"): string[] {
  const ast = topologyAst(src);
  return (ast?.deployables ?? [])
    .filter((d) => d.adapter === "client" && d.shells?.[shell] !== undefined)
    .map((d) => d.name)
    .sort();
}
