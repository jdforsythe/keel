/**
 * Comment data made safe to place between `<!--` and `-->`. Browsers' `outerHTML` writes it raw and their XML
 * serializer refuses `--` and a trailing `-` (well-formed mode); a comment carries no meaning, so the server
 * escapes instead of failing a render: every `--` becomes `- -`, a leading `>`/`->` and a trailing `-` get a
 * space. The result is a well-formed XML comment and cannot close early (`-->`, `--!>`, `<!-->`) or nest one.
 */
export function escapeComment(data: string): string {
  return data
    .replace(/-(?=-)/g, "- ")
    .replace(/^(?=-?>)/, " ")
    .replace(/-$/, "- ");
}
