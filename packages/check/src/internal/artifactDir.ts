/** `<dir>/.keel/<name>.json`, at the root or under any directory. */
const ARTIFACT = /^((?:.*\/)?)\.keel\/[^/]+\.json$/;

/**
 * The dir of the project a compiler artifact belongs to (rfc:0055): `""` for `.keel/ids.json`, `apps/a/` for
 * `apps/a/.keel/ids.json`; undefined for any other path. The writer puts `.keel/` in the project root.
 */
export function artifactDir(path: string): string | undefined {
  return ARTIFACT.exec(path)?.[1];
}
