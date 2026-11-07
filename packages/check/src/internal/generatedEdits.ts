import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Expected } from "./Expected.ts";
import { artifactDir } from "./artifactDir.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { hashOf } from "./hashOf.ts";
import { routesMismatch } from "./routesMismatch.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const GENERATED = /(?:^|\/)\.keel\/([^/]+\.json)$/;

function parse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * E1005 and W1005 (k.compiler, rfc:0050, rfc:0055) for each `<dir>/.keel/<name>.json` among the checked files.
 * `expected` maps a project dir (`artifactDir`) to the hashes the compiler derives from that project's sources:
 * a string, or `null` when only evaluating `routes.ts` derives it. The file must be one the compiler writes (a name
 * in `expected`), else E1005 (not among the compiled artifacts); then `{ data, hash }` in canonical JSON plus a
 * newline, with `hash` the content hash of `data`. A file with no `data` key (for example `{"hash":"abc"}`) is
 * malformed: reported, never hashed, no diff. A self-consistent file whose hash is not the expected one (forged or
 * stale) must be regenerated (no diff). One whose expected hash is `null` (`routes.json` beside an evaluated
 * `routes.ts`) is compared with the manifests' literals (rfc:0059): a mismatch is E1005, and parts that are not literals
 * are W1005, named. When only the bytes differ (data and hash intact) the fix restores them.
 */
export function generatedEdits(files: readonly SourceFile[], expected: ReadonlyMap<string, Expected>): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const file of files) {
    const name = GENERATED.exec(file.path)?.[1];
    if (name === undefined) continue;
    const project = expected.get(artifactDir(file.path) ?? "");
    const hashes = project?.hashes ?? {};
    const parsed = parse(file.source);
    const value = parsed.ok ? parsed.value : null;
    const data: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "data") : undefined;
    const hash: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "hash") : undefined;
    const known = Object.hasOwn(hashes, name);
    const want = known ? hashes[name] : undefined;
    const hasData = typeof value === "object" && value !== null && Object.hasOwn(value, "data");
    const consistent = hasData && typeof hash === "string" && hash === hashOf(data);
    const intact = consistent && (want === null || want === hash);
    const canonical = `${canonicalJson({ data, hash })}\n`;
    const shown = `.keel/${name.slice(0, 30)}`;
    const at = { path: file.path, line: 1, col: 1, see: "k.compiler" };
    const literals = want === null ? project?.routes : undefined;
    const off = literals === undefined ? undefined : routesMismatch(data, literals);
    if (intact && file.source === canonical && off === undefined) {
      const first = literals === undefined ? (want === null ? "routes" : undefined) : literals.unread[0];
      if (first !== undefined) {
        const rest = (literals?.unread.length ?? 1) - 1;
        const more = rest > 0 ? ` (+${rest} more)` : "";
        out.push({
          kind: "diag",
          code: "W1005",
          ...at,
          message: `${shown} unverified, not literal: ${first.slice(0, 34)}${more}`,
        });
      }
      continue;
    }
    const message = !known
      ? `${shown} is not among the compiled artifacts; remove it`
      : off !== undefined && intact
        ? `${shown} differs from routes.ts at "${off.slice(0, 24)}"; regenerate`
        : consistent && !intact
          ? `generated ${shown} does not match its sources; regenerate`
          : `hand edit to generated ${shown}; revert and regenerate`;
    const base: Diagnostic = { kind: "diag", code: "E1005", ...at, message };
    out.push(intact && off === undefined ? { ...base, fix: unifiedDiff(file.path, file.source, canonical) } : base);
  }
  return out;
}
