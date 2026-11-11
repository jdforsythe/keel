/** `node:22-slim`, pinned by its multi-platform index digest; the digest moves with Keel releases (ADR-0078). */
const BASE = "node:22-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d";

/**
 * `deploy/<name>/Dockerfile` of a `node` deployable (k.topology Deploy files): the built `dist/<name>/` only, run
 * as user `node`, storage on volume `/data`, port 8080. The build context is the project root after `keel build`.
 */
export function dockerfile(name: string): string {
  return [
    "# _generated: keel writes this from topology.ts (k.topology). Do not edit by hand.",
    `# Build from the project root after keel build: docker build -f deploy/${name}/Dockerfile .`,
    `FROM ${BASE}`,
    "WORKDIR /app",
    `COPY dist/${name}/ ./`,
    "RUN mkdir -p /data && chown node:node /data",
    "USER node",
    "VOLUME /data",
    "EXPOSE 8080",
    'CMD ["node", "--experimental-webstorage", "--localstorage-file=/data/storage", "--disable-warning=ExperimentalWarning", "server.mjs"]',
    "",
  ].join("\n");
}
