/**
 * A skill's title in the `keel docs` listing (k.docs): its `description` up to the last `;`, the whole description
 * when it has none. The codes after the last `;` let a host match the skill; the full text stays in the skill.
 */
export function skillTitle(description: string): string {
  const cut = description.lastIndexOf(";");
  return cut === -1 ? description : description.slice(0, cut).trimEnd();
}
