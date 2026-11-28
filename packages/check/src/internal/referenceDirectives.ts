import ts from "typescript";

/** TypeScript's triple-slash pragma: `///`, `<name`, white space, anything, `/>`, on one line. */
const TRIPLE_SLASH = /^\/\/\/\s*<(\S+)\s.*?\/>/im;
/** The reference kinds k.boundary Ambient types names, each matched as TypeScript matches a pragma argument. */
const KINDS = ["types", "path", "lib", "no-default-lib"].map(
  (name) => new RegExp(`(\\s${name}\\s*=\\s*)(?:(?:'([^']*)')|(?:"([^"]*)"))`, "im"),
);

/**
 * The `/// <reference types|path|lib|no-default-lib …/>` directives of `text`, as `[start, end)` offsets of each
 * comment. TypeScript reads a directive only among the comments before the first token of the file (a shebang
 * skipped), from a `//` comment, so a `///` after code or inside a string is none; each comment here is read with
 * TypeScript's own pragma expressions.
 */
export function referenceDirectives(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (const range of ts.getLeadingCommentRanges(text, 0) ?? []) {
    if (range.kind !== ts.SyntaxKind.SingleLineCommentTrivia) continue;
    const comment = text.slice(range.pos, range.end);
    if (TRIPLE_SLASH.exec(comment)?.[1]?.toLowerCase() !== "reference") continue;
    if (KINDS.some((kind) => kind.test(comment))) out.push({ start: range.pos, end: range.end });
  }
  return out;
}
