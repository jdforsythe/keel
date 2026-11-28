import type { SentRequest } from "./SentRequest.ts";

/** An origin the test owns (k.e2e Answered origins): a loopback server answering with the test's handler. */
export interface Answered {
  /** `http://127.0.0.1:<port>`, for a server's `env`. */
  readonly origin: string;
  /** Each request it received, in order (k.requests' shape), the mapped origin's URL for a browser's. */
  requests(): readonly SentRequest[];
  dispose(): Promise<void>;
}
