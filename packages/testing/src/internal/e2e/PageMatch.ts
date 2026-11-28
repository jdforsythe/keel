/** A `Match` as it crosses into the page: a `RegExp` as its source and flags. */
export type PageMatch = {
  readonly text?: string;
  readonly pattern?: { readonly source: string; readonly flags: string };
  readonly name?: string;
  readonly role?: string;
  readonly state?: Readonly<Record<string, unknown>>;
  readonly gone?: true;
};
