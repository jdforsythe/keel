/** A section's file in the Keel repo: `spec/kernel/<id>.md` or `spec/std/<id>.md`, when the tree holds one. */
export const sectionPath = (files: ReadonlyMap<string, string>, id: string): string | undefined =>
  [`spec/kernel/${id}.md`, `spec/std/${id}.md`].find((p) => files.has(p));
