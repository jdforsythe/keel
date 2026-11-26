import type { Answered } from "./Answered.ts";

/** `serve` options (k.e2e serve). */
export type ServeOptions = {
  /** The project folder; default the one `keel test` runs in. */
  readonly project?: string;
  /** Variables added last to each deployable's environment, or a function of the data folder's path returning them. */
  readonly env?: Readonly<Record<string, string>> | ((data: string) => Readonly<Record<string, string>>);
  /** Origins a page requests, each sent to an `answer` through the serve's proxy. */
  readonly origins?: Readonly<Record<string, Answered>>;
  /** `keel dev` in place of the built deployables. */
  readonly dev?: true;
  /** In a library's own folder: the component file (`src/Card.ts`) whose export its one page `/` renders (k.e2e Libraries). */
  readonly page?: string;
  readonly props?: Readonly<Record<string, unknown>>;
};
