/**
 * What `keel test --e2e` changes of a run (k.e2e Files): the two e2e globs as `include`, `environment` `node`, at most 2
 * files at once, `testTimeout` and `hookTimeout` its scaled 60 s, `KEEL_E2E=1` and the engine in the environment.
 */
export type E2eRun = {
  readonly include: readonly string[];
  readonly timeout: number;
  readonly env: Readonly<Record<string, string>>;
};
