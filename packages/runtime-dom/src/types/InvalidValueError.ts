import type { SchemaError } from "@keel/schema";

/**
 * A host element's value or `emit` that failed its schema (k.host-element Parse, k.host-code Events): the
 * `schema.invalid` the parse returned, with `data.at` the element's id, as the nearest Boundary's fallback gets it.
 */
export type InvalidValueError = SchemaError & { readonly data: { readonly at: string } };
