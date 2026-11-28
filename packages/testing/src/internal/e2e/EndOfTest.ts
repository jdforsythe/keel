import type { ServeRun } from "./ServeRun.ts";

/** The end of the test running now (testEnd.ts): what it disposes, and the serves whose failure it reports. */
export type EndOfTest = {
  readonly disposeAtEnd: (dispose: () => Promise<void>) => void;
  readonly serveAtEnd: (run: ServeRun) => void;
};
