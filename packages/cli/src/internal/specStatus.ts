import type { SourceFile } from "../types/SourceFile.ts";

/** Each spec section's status line (`status: conformance-covered`), by id, from `spec/{kernel,std}/<id>.md`. */
export function specStatus(files: readonly SourceFile[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of files) {
    const id = /^spec\/(?:kernel|std)\/([^/]+)\.md$/.exec(f.path)?.[1];
    const status = /^status:\s*(\S+)/m.exec(f.source)?.[1];
    if (id !== undefined && status !== undefined) out.set(id, status);
  }
  return out;
}
