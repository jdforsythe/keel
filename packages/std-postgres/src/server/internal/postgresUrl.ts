/**
 * The store's URL (std.postgres Modes): `KEEL_POSTGRES_URL`; missing, `pglite:<KEEL_DEV_DIR>/postgres` when
 * `KEEL_DEV_DIR` is set (`keel dev`); else `undefined`, which `engineFor` answers with E2455.
 */
export function postgresUrl(): string | undefined {
  const url = process.env.KEEL_POSTGRES_URL;
  if (url !== undefined && url !== "") return url;
  const dev = process.env.KEEL_DEV_DIR;
  return dev === undefined || dev === "" ? url : `pglite:${dev.replace(/\/+$/, "")}/postgres`;
}
