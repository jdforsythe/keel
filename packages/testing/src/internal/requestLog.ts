import type { Net } from "@keel/ctx";
import { tapNet } from "@keel/ctx/internal";
import type { SentRequest } from "../types/SentRequest.ts";
import type { SentLog } from "./SentLog.ts";

/**
 * A log of the requests (k.requests): each `push` keeps the request's method, URL and header names (lower case,
 * sorted) and nothing else, so no value or body is ever held. With `net`, every `fetch` it is given until `close` is
 * pushed; without, the caller pushes (a browser front's).
 */
export function requestLog(net?: Net): SentLog {
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
