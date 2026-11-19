import fs from "node:fs";
import path from "node:path";

/**
 * Write `.keel/<name>` under `root` atomically and read-only (temp file, chmod 444, rename): the one writer of the
 * Vite plugin and `buildRoutes` (rfc:0059), so both produce the same bytes for the same `artifactText`.
 */
export function writeArtifact(root: string, name: string, text: string): void {
  const dir = path.join(root, ".keel");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.chmodSync(tmp, 0o444);
  fs.renameSync(tmp, file);
}
