/** Generated, read-only locations (k.compiler E1005): `.keel/`, `turbo.json`, CI workflows, Dockerfiles, compose. */
export function isGenerated(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  return (
    path.startsWith(".keel/") ||
    path === ".keel" ||
    path === "turbo.json" ||
    path.startsWith(".github/workflows/") ||
    base.startsWith("Dockerfile") ||
    /^(?:docker-)?compose\.ya?ml$/.test(base)
  );
}
