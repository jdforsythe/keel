import type { SentRequest } from "../types/SentRequest.ts";

/** The requests a harness's page sent: `push` adds one, `entries` lists them, `close` stops the tap. */
export interface SentLog {
  push(req: Request): void;
  entries(): readonly SentRequest[];
  close(): void;
}
