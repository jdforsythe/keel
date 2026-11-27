/**
 * One recorded probe of a cache entry (k.derived Derivation cache): a question the evaluation's code or its resolver
 * asked, with the answer it got. `exists` (`yes` or `no`), `stat` and `lstat` (`no`, or the kind, `file <size>
 * <mode>`, `folder <mode>`, `link` for `lstat`, `other`; never a time), `realpath` (the real path, `null` when it
 * resolves to none) and `list` (the SHA-256 of the sorted entries, each name with `/` after a folder's and `@` after a
 * link's, `null` for no folder) take an absolute path; `process` a fact of the process by name, `navigator.<name>`, or
 * `Intl.locale` and `Intl.timeZone`, the default locale and time zone (its JSON, a function called with no arguments);
 * `call` a recorded built-in's call, `<module>.<function>:<JSON arguments>` (its result's JSON); `field` a field of a
 * stat result, `<stat|lstat> <field> <path>` (the field of the `bigint` stat as a decimal string, `null` for none); `env` takes a `process.env` name (its value, `null` when absent); `env-names` the SHA-256 of every name, when
 * the code listed them (`path` empty).
 */
export type CacheProbe = {
  readonly kind: "exists" | "stat" | "lstat" | "realpath" | "list" | "process" | "call" | "field" | "env" | "env-names";
  readonly path: string;
  readonly answer: string | null;
};
