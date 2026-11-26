/**
 * One section as `keel docs` lists it: its title and status (a section's own first two lines; status read in the Keel
 * repo only), the package that owns it (empty in the repo), what it holds (its area file's row) and the codes it cites.
 */
export type DocsRow = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly package: string;
  readonly holds: string;
  readonly codes: readonly string[];
};
