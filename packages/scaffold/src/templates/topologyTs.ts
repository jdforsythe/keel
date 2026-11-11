/** `topology.ts` (k.topology): one `web` deployable holding `modules` on `adapter` (`client`: no server), one deployable per line. */
export function topologyTs(modules: readonly string[], adapter: "client" | "node" | "static"): string {
  const list = modules.map((m) => `"${m}"`).join(", ");
  return [
    `import { topology } from "@keel/server";`,
    "",
    "export default topology({",
    `  web: { modules: [${list}], adapter: "${adapter}" },`,
    "});",
    "",
  ].join("\n");
}
