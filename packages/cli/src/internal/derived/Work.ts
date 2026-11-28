/**
 * The work one run did on the derived files (k.derived Work), counted where it happens: `evaluated`, evaluations run;
 * `cached`, evaluated derivations taken from the cache; `refreshed`, views written.
 */
export type Work = { evaluated: number; cached: number; refreshed: number };
