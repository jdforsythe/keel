import { attempt } from "@keel/schema";
/** `member` applied, failing closed: a throw is a denial. */
export function allowed<A>(member: (at: A) => boolean, at: A): boolean {
  const asked = attempt(() => member(at) === true);
  return asked.ok && asked.value;
}
