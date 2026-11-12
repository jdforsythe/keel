import { peerKey } from "@keel/compiler/hosting/peerKey";
/**
 * `deploy/compose.yaml` (k.topology Deploy files): a service and a named volume per `node` deployable (sorted),
 * published on host ports from 8080 up; each peer's `KEEL_PEER_<NAME>` is its service URL. `KEEL_ORIGIN` and
 * `KEEL_SECRET` come from the environment and are never written here.
 */
export function composeYaml(nodes: readonly string[]): string {
  const lines = ["# _generated: keel writes this from topology.ts (k.topology). Do not edit by hand.", "services:"];
  nodes.forEach((name, i) => {
    const service = name.toLowerCase();
    lines.push(
      `  ${service}:`,
      "    build:",
      "      context: ..",
      `      dockerfile: deploy/${name}/Dockerfile`,
      "    ports:",
      `      - "${8080 + i}:8080"`,
      "    environment:",
      "      KEEL_ORIGIN: ${KEEL_ORIGIN:?}",
      "      KEEL_SECRET: ${KEEL_SECRET:?}",
      ...nodes.filter((p) => p !== name).map((p) => `      ${peerKey(p)}: http://${p.toLowerCase()}:8080`),
      "    volumes:",
      `      - ${service}-data:/data`,
    );
  });
  lines.push("volumes:", ...nodes.map((name) => `  ${name.toLowerCase()}-data: {}`), "");
  return lines.join("\n");
}
