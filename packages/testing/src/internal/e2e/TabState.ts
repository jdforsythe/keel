import type { Request, Route, Page as Tab } from "playwright-core";
import type { LoadedDocument } from "../../types/LoadedDocument.ts";
import type { Problem } from "../../types/Problem.ts";
import type { SentRequest } from "../../types/SentRequest.ts";

/** What a page handle tracks of its tab (makePage.ts). */
export type TabState = {
  readonly tab: Tab;
  readonly problems: Problem[];
  readonly requests: SentRequest[];
  readonly documents: LoadedDocument[];
  /** Requests with no answer yet; an event stream is answered once its headers arrive. */
  readonly inflight: Set<Request>;
  /** A held page's scripts, parked until `resume()`. */
  readonly parked: Route[];
  /** Whether the tab's scripts are held. */
  holding: boolean;
  /** Whether the document has fired `load` since its navigation. */
  loaded: boolean;
  readonly waiters: Set<() => void>;
};
