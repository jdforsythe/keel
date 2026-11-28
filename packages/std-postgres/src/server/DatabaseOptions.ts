/**
 * What `database(name, opts)` takes (std.postgres): `migrations`, given, maps `./migrations/NNNN-<kebab>.sql` to its
 * text and is read instead of the module's `migrations/` folder of the app.
 */
export type DatabaseOptions = {
  readonly migrations?: Readonly<Record<string, string>>;
};
