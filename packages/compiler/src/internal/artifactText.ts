import { canonicalJson } from "./canonicalJson.ts";
import { hashOf } from "./hashOf.ts";

/** The bytes of `.keel/<name>` for `data` (k.compiler Artifacts): `{ data, hash }` in canonical JSON plus a newline. */
export function artifactText(data: unknown): string {
  return `${canonicalJson({ data, hash: hashOf(data) })}\n`;
}
