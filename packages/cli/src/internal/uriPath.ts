import { relPath } from "./relPath.ts";
import { safeDecode } from "./safeDecode.ts";

/** Project-relative path of a `file://` URI under `root`. */
export function uriPath(root: string, uri: string): string {
  const abs = uri.startsWith("file://") ? safeDecode(uri.slice(7)) : uri;
  return relPath(root, abs);
}
