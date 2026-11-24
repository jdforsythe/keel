import type { Net } from "@keel/ctx";
import { tapNet } from "@keel/ctx/internal";
import type { SentRequest } from "../types/SentRequest.ts";

/** The requests a harness's page sent: `push` adds one, `entries` lists them, `close` stops the tap. */
export interface RequestLog {
  push(req: Request): void;
  entries(): readonly SentRequest[];
  close(): void;
}

/**
 * A log of the requests (k.requests): each `push` keeps the request's method, URL and header names (lower case,
 * sorted) and nothing else, so no value or body is ever held. With `net`, every `fetch` it is given until `close` is
 * pushed; without, the caller pushes (a browser front's).
 */
export function requestLog(net?: Net): RequestLog {
  const kept: SentRequest[] = [];
  let open = true;
  const push = (req: Request): void => {
    if (!open) return;
    kept.push({ method: req.method, url: req.url, headers: [...new Set(req.headers.keys())].sort() });
  };
  const stop = net === undefined ? undefined : tapNet(net, push);
  return {
    push,
    entries: () => [...kept],
    close: () => {
      open = false;
      stop?.();
    },
  };
}
