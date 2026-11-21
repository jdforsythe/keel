/** What `database(name, opts)` takes (std.postgres): `migrations` maps `./migrations/NNNN-<kebab>.sql` to its text. */
export type DatabaseOptions = {
  readonly migrations: Readonly<Record<string, string>>;
};
