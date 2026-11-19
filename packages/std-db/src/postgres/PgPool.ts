import type { PgClient } from "./PgClient.ts";

/** The part of a `pg` `Pool` the Postgres driver uses; `postgres(url, { clientFactory })` returns one. */
export type PgPool = {
  query(text: string, values?: readonly unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
  connect(): Promise<PgClient>;
  end(): Promise<void>;
};
