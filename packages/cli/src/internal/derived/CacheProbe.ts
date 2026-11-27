/**
 * One recorded probe of a cache entry (k.derived Derivation cache): a question the evaluation's code asked, with the
 * answer it got. `exists` (`yes` or `no`), `realpath` (the real path, `null` when it resolves to none) and `list` (the
 * SHA-256 of the sorted entry names, `null` for no folder) take an absolute path; `env` takes a `process.env` name (its
 * value, `null` when absent); `env-names` the SHA-256 of every name, when the code listed them (`path` empty).
 */
export type CacheProbe = {
  readonly kind: "exists" | "realpath" | "list" | "env" | "env-names";
  readonly path: string;
  readonly answer: string | null;
};
