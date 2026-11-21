/** A statement's answer as either engine gives it: each column's name and type oid, rows of Postgres text values, the count of rows. */
export type Raw = {
  readonly fields: readonly { readonly name: string; readonly oid: number }[];
  readonly rows: readonly (readonly unknown[])[];
  readonly count: number;
};
