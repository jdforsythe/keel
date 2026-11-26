import { canonicalJson, hashOf } from "@keel/compiler/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Expected } from "./Expected.ts";
import { artifactDir } from "./artifactDir.ts";
import { readSurface } from "./compat/readSurface.ts";
import { staleSource } from "./compat/staleSource.ts";
import { routesMismatch } from "./routesMismatch.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const GENERATED = /(?:^|\/)\.keel\/([^/]+\.json)$/;
/** `.keel/` files k.ledger reads that the compiler never writes: an app's committed ledger and production tallies. */
const LEDGER_FILES = new Set(["ledger.json", "monitored.json"]);
/** `.keel/` files derived from the evaluated tokens (k.schemes): judged only when the project's tokens are known. */
const EVALUATED = new Set(["schemes.json"]);

function parse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * E1005 and W1005 (k.compiler) for each `<dir>/.keel/<name>.json` among the checked files, except the ledger's own
 * `ledger.json` and `monitored.json` (k.ledger); `schemes.json` is judged against the evaluated tokens' schemes
 * (k.schemes), and not at all in a project whose `tokens.ts` gave none.
 * `expected` maps a project dir (`artifactDir`) to the hashes the compiler derives from that project's sources:
 * a string, or `null` when only evaluating the contracts and bindings derives it. The file must be one the compiler writes (a name
 * in `expected`), else E1005 (not among the compiled artifacts); then `{ data, hash }` in canonical JSON plus a
 * newline, with `hash` the content hash of `data`. A file with no `data` key (for example `{"hash":"abc"}`) is
 * malformed: reported, never hashed, no diff. A self-consistent file whose hash is not the expected one (forged or
 * stale) must be rebuilt by `keel build` (no diff). One whose expected hash is `null` (`routes.json`, evaluated from the
 * contracts and bindings) is compared with their literals (`routesMismatch`): a mismatch is E1005, and parts that are not literals
 * are W1005, named. `surface.json` (k.compat) is derived by evaluation: intact when every source it records is unchanged
 * in `sources`. When only the bytes differ (data and hash intact) the fix restores them.
 */
export function generatedEdits(
  files: readonly SourceFile[],
  expected: ReadonlyMap<string, Expected>,
  sources: readonly SourceFile[],
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const file of files) {
    const name = GENERATED.exec(file.path)?.[1];
    if (name === undefined || LEDGER_FILES.has(name)) continue;
    const project = expected.get(artifactDir(file.path) ?? "");
    const hashes = project?.hashes ?? {};
    if (EVALUATED.has(name) && !Object.hasOwn(hashes, name)) continue;
    const parsed = parse(file.source);
    const value = parsed.ok ? parsed.value : null;
    const data: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "data") : undefined;
    const hash: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "hash") : undefined;
    const surface = name === "surface.json" ? readSurface(data) : undefined;
    const known = surface !== undefined || Object.hasOwn(hashes, name);
    const want = known && surface === undefined ? hashes[name] : undefined;
    const hasData = typeof value === "object" && value !== null && Object.hasOwn(value, "data");
    const consistent = hasData && typeof hash === "string" && hash === hashOf(data);
    const fresh =
      surface === undefined
        ? want === null || want === hash
        : surface !== null && staleSource(surface, artifactDir(file.path) ?? "", sources) === undefined;
    const intact = consistent && fresh;
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
    const moved =
      surface === undefined || surface === null
        ? undefined
        : staleSource(surface, artifactDir(file.path) ?? "", sources);
    const message = !known
      ? `${shown} is not among the compiled artifacts; remove it`
      : off !== undefined && intact
        ? `${shown} differs from the contracts and bindings at "${off.slice(0, 24)}"; run keel build`
        : consistent && !intact && moved !== undefined
          ? `${shown} is stale, ${moved.slice(-34)} changed; run keel build`
          : consistent && !intact
            ? `generated ${shown} does not match its sources; run keel build`
            : `hand edit to generated ${shown}; revert and run keel build`;
    const base: Diagnostic = { kind: "diag", code: "E1005", ...at, message };
    out.push(intact && off === undefined ? { ...base, fix: unifiedDiff(file.path, file.source, canonical) } : base);
  }
  return out;
}
