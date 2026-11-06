/**
 * Add a form-level entry under the root path `''` summarising issues no known field path covers (neither the
 * path itself, an ancestor, nor a descendant of a `field()` path), so a blocked submit is never silent.
 */
export function withUnmapped(
  messages: Readonly<Record<string, string>>,
  known: Iterable<string>,
): Record<string, string> {
  const fields = [...known];
  const covered = (p: string): boolean =>
    p !== "" && fields.some((f) => f === p || f.startsWith(`${p}.`) || p.startsWith(`${f}.`));
  const unmapped = Object.entries(messages).filter(([p]) => p !== "" && !covered(p));
  const out: Record<string, string> = { ...messages };
  const [first] = unmapped;
  if (first === undefined) return out;
  const summary = `${first[0]}: ${first[1]}${unmapped.length > 1 ? ` (+${unmapped.length - 1} more)` : ""}`;
  out[""] = out[""] === undefined ? summary : `${out[""]}; ${summary}`;
  return out;
}
