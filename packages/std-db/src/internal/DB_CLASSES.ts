/**
 * What `db.failed` says of a driver's failure (std.db): the SQLSTATE class of a Postgres error, `sqlite` for a SQLite
 * result code, `system` for a system error code, `unknown` for any other.
 */
export const DB_CLASSES = [
  ...["00", "01", "02", "03", "08", "09", "0A", "0B", "0F", "0L", "0P", "0Z", "20", "21", "22", "23", "24", "25"],
  ...["26", "27", "28", "2B", "2D", "2F", "34", "38", "39", "3B", "3D", "3F", "40", "42", "44", "53", "54", "55"],
  ...["57", "58", "72", "F0", "HV", "P0", "XX", "sqlite", "system", "unknown"],
] as const;
