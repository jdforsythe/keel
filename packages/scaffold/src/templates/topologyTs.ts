/** `topology.ts` (k.topology): one `web` deployable holding `modules` on `adapter` (`client`: no server) with the brand fonts in `styles`, one deployable per line. */
export function topologyTs(modules: readonly string[], adapter: "client" | "node" | "static"): string {
  const list = modules.map((m) => `"${m}"`).join(", ");
  return [
    `import { topology } from "@keel/server";`,
    "",
    "export default topology({",
    `  web: { modules: [${list}], adapter: "${adapter}", styles: ["@keel/ui/fonts"] },`,
    "});",
    "",
  ].join("\n");
}
