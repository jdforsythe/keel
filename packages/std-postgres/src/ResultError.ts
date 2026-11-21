import type { KeelError } from "@keel/schema";

/** A row that fails its statement's schema (std.postgres): its 0-based index and the issues' paths and rules, no value. */
export type ResultError = KeelError<
  "postgres.result",
  {
    readonly row: number;
    readonly issues: readonly { readonly path: readonly (string | number)[]; readonly rule: string }[];
  }
>;
