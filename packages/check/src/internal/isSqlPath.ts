/** A SQL file a rule's `sql` reads: a module's migration, `modules/<id>/migrations/NNNN-<kebab>.sql`, at any depth. */
export function isSqlPath(path: string): boolean {
  return /(?:^|\/)modules\/[^/]+\/migrations\/[^/]+\.sql$/.test(path);
}
