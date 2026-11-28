/** The served route the server writes into `#k-state` (k.runtime, rfc:0071): `params` and `search` schema-encoded. */
export type ServedRoute = {
  readonly id: string;
  readonly path: string;
  readonly href: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly search: Readonly<Record<string, unknown>>;
};
