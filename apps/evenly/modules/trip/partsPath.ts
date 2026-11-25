/** The form path of one person's parts, a typed key of the draft's `parts` record. */
export default function partsPath(person: string): `parts.${string}` {
  return `parts.${person}`;
}
