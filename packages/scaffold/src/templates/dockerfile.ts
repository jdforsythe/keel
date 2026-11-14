/** `node:22-slim`, pinned by its multi-platform index digest; the digest moves with Keel releases (ADR-0078). */
const BASE = "node:22-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d";

/**
 * `deploy/<name>/Dockerfile` of a `node` deployable (k.deploy Deploy files): the built `dist/<name>/` only, run as user
 * `node`, port 8080. `'file'` storage: volume `/data`, owned by `node`, and `--localstorage-file=/data/storage`;
 * `'sqlite'`: that volume and no storage flag; `'postgres'`: no volume. The build context is the project root after
 * `keel build`.
 */
export function dockerfile(name: string, storage: "file" | "sqlite" | "postgres" = "file"): string {
  const volume = storage !== "postgres";
  const flags = storage === "file" ? '"--experimental-webstorage", "--localstorage-file=/data/storage", ' : "";
  return [
    "# _generated: keel writes this from topology.ts (k.topology). Do not edit by hand.",
    `# Build from the project root after keel build: docker build -f deploy/${name}/Dockerfile .`,
    `FROM ${BASE}`,
    "WORKDIR /app",
    `COPY dist/${name}/ ./`,
    ...(volume ? ["RUN mkdir -p /data && chown node:node /data"] : []),
    "USER node",
    ...(volume ? ["VOLUME /data"] : []),
    "EXPOSE 8080",
    `CMD ["node", ${flags}"--disable-warning=ExperimentalWarning", "server.mjs"]`,
    "",
  ].join("\n");
}
