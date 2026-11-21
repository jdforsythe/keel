/** The files a review reads at one revision (or the working tree): git-root paths and their text. */
export type Snapshot = {
  readonly paths: readonly string[];
  readonly text: (path: string) => string | undefined;
  /** Read these paths' text in one go before `text` asks for them one by one. */
  readonly prefetch: (paths: readonly string[]) => void;
};
