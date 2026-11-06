/** Emitted specifier, not an import of this package (kept out of the S0003 import scan). */
const SERVER = "@keel/server";

/** `topology.ts` (k.server): one `web` deployable on the node adapter holding `modules`. */
export function topologyTs(modules: readonly string[]): string {
  const list = modules.map((m) => `'${m}'`).join(", ");
  return [
    `import { topology } from '${SERVER}'`,
    "",
    `export default topology({ web: { modules: [${list}], adapter: 'node' } })`,
    "",
  ].join("\n");
}
