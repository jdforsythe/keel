const BRACES = /\{([A-Za-z_$][\w$]*)\}|[{}]/g;

/**
 * The `{name}` placeholders of a template, with offsets of each `{` and past its `}`; `undefined` when a brace is not
 * part of one (templates have no literal braces).
 */
export function placeholders(template: string): { name: string; start: number; end: number }[] | undefined {
  const out: { name: string; start: number; end: number }[] = [];
  for (const m of template.matchAll(BRACES)) {
    const name = m[1];
    if (name === undefined) return undefined;
    out.push({ name, start: m.index, end: m.index + m[0].length });
  }
  return out;
}
