import { peerKey } from "@keel/compiler/hosting/peerKey";
/**
 * `deploy/compose.yaml` (k.deploy Deploy files): a service per `node` deployable (sorted), published on host ports from
 * 8080 up, and a named volume per one with a volume (`'file'` and `'sqlite'` storage); each peer's `KEEL_PEER_<NAME>` is
 * its service URL. `KEEL_ORIGIN`, `KEEL_SECRET` and `KEEL_DATABASE_URL` (required for `'postgres'`; for `'sqlite'` passed
 * through when set, the driver's default file otherwise) come from the environment and are never written here, as does
 * `KEEL_POSTGRES_URL`, required, for one `appData` names (it serves a module whose `deps` list `@keel/std-postgres`).
 */
export function composeYaml(
  nodes: readonly string[],
  storage: (name: string) => "file" | "sqlite" | "postgres" = () => "file",
  appData: (name: string) => boolean = () => false,
): string {
  const lines = ["# _generated: keel writes this from topology.ts (k.topology). Do not edit by hand.", "services:"];
  const volumed = nodes.filter((n) => storage(n) !== "postgres");
  nodes.forEach((name, i) => {
    const st = storage(name);
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
      ...(st === "postgres" ? ["      KEEL_DATABASE_URL: ${KEEL_DATABASE_URL:?}"] : []),
      ...(st === "sqlite" ? ["      KEEL_DATABASE_URL:"] : []),
      ...(appData(name) ? ["      KEEL_POSTGRES_URL: ${KEEL_POSTGRES_URL:?}"] : []),
      ...nodes.filter((p) => p !== name).map((p) => `      ${peerKey(p)}: http://${p.toLowerCase()}:8080`),
      ...(st === "postgres" ? [] : ["    volumes:", `      - ${service}-data:/data`]),
    );
  });
  if (volumed.length > 0) lines.push("volumes:", ...volumed.map((name) => `  ${name.toLowerCase()}-data: {}`));
  lines.push("");
  return lines.join("\n");
}
