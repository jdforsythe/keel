/**
 * The project (k.ledger-items Projects) a path from the ledger's folder belongs to, among `projects` (`ledgerProjects`):
 * the one whose folder holds it, else `.`.
 */
export function projectOf(path: string, projects: readonly string[]): string {
  return projects.find((p) => p !== "." && path.startsWith(`${p}/`)) ?? ".";
}
