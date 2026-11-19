/** A client checked out of a `PgPool`; `release(true)` drops a broken one. */
export type PgClient = {
  query(text: string, values?: readonly unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
  release(destroy?: boolean): void;
};
