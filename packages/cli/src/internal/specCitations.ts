const SPEC_LINE = /^\/\/\s*Spec:/;
const FORM = /^\/\/\s*Spec:\s*([A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*),\s*clause\s*"/;
const SECTION = /^\/\/\s*Spec:\s*([A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*)/;
const LOOSE_QUOTE = /"((?:\\.|[^"\\])*)"?/;

/** The index of the first `"` in `s` from `from` with no `\` before it, or -1. */
const closing = (s: string, from: number): number => {
  for (let i = from; i < s.length; i++) if (s[i] === '"' && s[i - 1] !== "\\") return i;
  return -1;
};

/**
 * The `// Spec:` lines of a conformance file's header (k.ledger-items Citation), each `{ line, section, quote,
 * formed }`. `head` is the header's `//` lines (`{ line, text }`, before the first statement other than an import).
 * A formed line is `// Spec: <section>, clause "<quote>"`: the quote opens at the `"` after `clause`, closes at the next
 * `"` with no `\` before it, and goes on in the next line, a `//` line, joined by one space, while still open at a line's end;
 * text after it is a note holding no `"`. Any other `// Spec:` line is not formed, with the section and the first
 * quote it holds when it holds them (for the nearest bullet E1732 names). `quote` keeps `\"` as written.
 */
export function specCitations(
  head: readonly { line: number; text: string }[],
): { line: number; section: string | undefined; quote: string | undefined; formed: boolean }[] {
  const out: { line: number; section: string | undefined; quote: string | undefined; formed: boolean }[] = [];
  for (const [i, h] of head.entries()) {
    if (!SPEC_LINE.test(h.text)) continue;
    const form = FORM.exec(h.text);
    const section = form?.[1] ?? SECTION.exec(h.text)?.[1];
    if (form?.[1] === undefined) {
      out.push({ line: h.line, section, quote: LOOSE_QUOTE.exec(h.text)?.[1], formed: false });
      continue;
    }
    let text = h.text.slice(form[0].length);
    let end = closing(text, 0);
    for (let j = i + 1; end < 0 && j < head.length; j++) {
      const next = head[j]?.text ?? "";
      if (SPEC_LINE.test(next) || head[j]?.line !== (head[j - 1]?.line ?? 0) + 1) break;
      const from = text.length + 1;
      text = `${text} ${next.replace(/^\/\/\s?/, "")}`;
      end = closing(text, from);
    }
    if (end < 0) {
      out.push({ line: h.line, section, quote: text, formed: false });
      continue;
    }
    const quote = text.slice(0, end);
    out.push({ line: h.line, section, quote, formed: !text.slice(end + 1).includes('"') });
  }
  return out;
}
