/** Rename the first `.`/`-` delimited segment of an element id when it is a whole old name (`cart.submit`, `OrderCard-root`). */
export function rewriteId(id: string, names: ReadonlyMap<string, string>): string {
  const m = /^([^.-]+)(.*)$/s.exec(id);
  const head = m?.[1];
  const to = head === undefined ? undefined : names.get(head);
  return to === undefined ? id : `${to}${m?.[2] ?? ""}`;
}
