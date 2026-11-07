/**
 * A numeric option value: a literal; a reference to a constant still to resolve (`SEED`), or to a key of an
 * imported options object (`opts.numRuns`, with the value that applies when the object lacks the key); or unknown.
 */
export type NumRef =
  | number
  | { readonly ref: string; readonly key?: string; readonly fallback?: number | undefined }
  | undefined;
