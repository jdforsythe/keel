import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { hashOf } from "./hashOf.ts";
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
 * E1005 (k.compiler, rfc:0050): a `.keel/<name>.json` among the checked files that is not exactly what the compiler
 * writes: `{ data, hash }` in canonical JSON plus a newline, `hash` equal to the content hash of `data`, and, for
 * an artifact at the root `.keel/`, equal to `expected[name]` (the hash the compiler derives from the current
 * sources) when that is known. A file with no `data` key (for example `{"hash":"abc"}`) is malformed: reported,
 * never hashed, no diff. When only the bytes differ (data and hash intact) the fix restores them; a self-consistent
 * file whose hash is not the expected one (forged or stale) must be regenerated (no diff).
 */
export function generatedEdits(
  files: readonly SourceFile[],
  expected: Readonly<Record<string, unknown>>,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const file of files) {
    const name = GENERATED.exec(file.path)?.[1];
    if (name === undefined) continue;
    const parsed = parse(file.source);
    const value = parsed.ok ? parsed.value : null;
    const data: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "data") : undefined;
    const hash: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "hash") : undefined;
    const want = file.path.startsWith(".keel/") && Object.hasOwn(expected, name) ? expected[name] : undefined;
    const hasData = typeof value === "object" && value !== null && Object.hasOwn(value, "data");
    const consistent = hasData && typeof hash === "string" && hash === hashOf(data);
    const intact = consistent && (want === undefined || want === hash);
    const canonical = `${canonicalJson({ data, hash })}\n`;
    if (intact && file.source === canonical) continue;
    const base: Diagnostic = {
      kind: "diag",
      code: "E1005",
      path: file.path,
      line: 1,
      col: 1,
      message:
        consistent && !intact
          ? `generated .keel/${name.slice(0, 30)} does not match its sources; regenerate`
          : `hand edit to generated .keel/${name.slice(0, 30)}; revert and regenerate`,
      see: "k.compiler",
    };
    out.push(intact ? { ...base, fix: unifiedDiff(file.path, file.source, canonical) } : base);
  }
  return out;
}
