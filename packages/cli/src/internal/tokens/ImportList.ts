/** The imports of a program: each local name with its source and imported name (`<source>#<name>`), and where the first starts and the last ends. */
export type ImportList = {
  readonly from: ReadonlyMap<string, string>;
  readonly lastEnd: number;
  readonly firstStart: number;
};
