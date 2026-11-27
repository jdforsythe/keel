type Span = { readonly start: number; readonly end: number };

const inside = (x: Span, y: Span): boolean => x.start >= y.start && x.end <= y.end;

/**
 * E1451's fix sites by place (k.fixes Per code), whatever parser read them: each `throw` start offset of `throws` with
 * the innermost of `fns` holding it, but those a `caught` block (a `try` block that has a `catch`) holds within that
 * function. A throw in no function is none.
 */
export function throwOwners<F extends Span>(
  throws: readonly number[],
  fns: readonly F[],
  caught: readonly Span[],
): { at: number; owner: F }[] {
  const out: { at: number; owner: F }[] = [];
  for (const at of throws) {
    const here = { start: at, end: at + 1 };
    let owner: F | undefined;
    for (const f of fns) if (inside(here, f) && (owner === undefined || f.start > owner.start)) owner = f;
    if (owner === undefined) continue;
    const within = owner;
    if (caught.some((b) => inside(here, b) && inside(b, within))) continue;
    out.push({ at, owner });
  }
  return out;
}
