import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseTopology } from "@keel/compiler";
import { cspText } from "./cspText.ts";

/**
 * Binary only: `keel build`'s `dist/<name>/csp.txt` for each `client` and `static` deployable of `topologySource`
 * (k.security Other deployables), after the Vite builds. Returns a Keel-coded note when the policy entry
 * (`@keel/server/csp`) does not load, so no file can be written.
 */
export async function writeCspFiles(
  cwd: string,
  topologySource: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): Promise<string[]> {
  if (topologySource === undefined) return [];
  const topology = parseTopology(topologySource).topology;
  const names = Object.keys(topology)
    .sort()
    .filter((n) => topology[n]?.adapter === "client" || topology[n]?.adapter === "static");
  if (names.length === 0) return [];
  const text = await cspText(cwd, topology, env);
  if (text === undefined) return ["E1049 csp.txt not written: @keel/server/csp does not load\n"];
  for (const name of names) {
    mkdirSync(join(cwd, "dist", name), { recursive: true });
    writeFileSync(join(cwd, "dist", name, "csp.txt"), `${text}\n`);
  }
  return [];
}
