import fs from "node:fs";
import path from "node:path";

/**
 * Write `.keel/<name>` under `root` atomically and read-only (temp file, chmod 444, rename; k.derived Refresh), the
 * Vite plugin's writer; a file that already holds `text` is left as it is. Throws when the folder cannot be written.
 */
export function writeArtifact(root: string, name: string, text: string): void {
  const dir = path.join(root, ".keel");
  const file = path.join(dir, name);
  try {
    if (fs.readFileSync(file, "utf8") === text) return;
  } catch {
    // absent: written below
  }
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.chmodSync(tmp, 0o444);
  fs.renameSync(tmp, file);
}
