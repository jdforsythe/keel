/** `member` applied, failing closed: a throw is a denial. */
export function allowed<A>(member: (at: A) => boolean, at: A): boolean {
  try {
    return member(at) === true;
  } catch {
    return false;
  }
}
