import { normClause } from "./normClause.ts";

/**
 * The `// Spec:` header blocks of a conformance file (k.testing Ledger), from its header comments (`{ line, text }`,
 * the `//` lines before its first statement other than an import). A block starts at a `// Spec: <id>` line and
 * takes the directly following `//` lines up to the next `// Spec:` or `// Clause:` line, so a quoted clause may
 * wrap. `section` is the id right after `Spec:`; `text` is the joined block normalised by `normClause`.
 */
export function specHeaders(
  head: readonly { line: number; text: string }[],
): { line: number; section: string; text: string }[] {
  const out: { line: number; section: string; parts: string[] }[] = [];
  let open: { line: number; section: string; parts: string[] } | undefined;
  let last = -1;
  for (const h of head) {
    const body = h.text.replace(/^\/\/\s?/, "");
    const spec = /^\s*Spec:\s*([A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*)/.exec(body);
    if (spec?.[1] !== undefined) {
      open = { line: h.line, section: spec[1], parts: [body] };
      out.push(open);
    } else if (open !== undefined && h.line === last + 1 && !/^\s*Clause:/.test(body)) open.parts.push(body);
    else open = undefined;
    last = h.line;
  }
  return out.map((b) => ({ line: b.line, section: b.section, text: normClause(b.parts.join(" ")) }));
}
