import { err } from "@keel/schema";
import { jsonResponse } from "./jsonResponse.ts";

/** 503 with a `keel.busy` `err` body (data `{ limit }`, the open event-stream cap), like `payloadTooLarge`; nothing ran. */
export function busy(limit: number): Response {
  const res = jsonResponse(
    503,
    err({ code: "keel.busy", message: `more than ${limit} open event streams`, data: { limit } }),
  );
  res.headers.set("cache-control", "no-store");
  return res;
}
