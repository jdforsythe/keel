import { err } from "@keel/schema";
import { jsonResponse } from "./jsonResponse.ts";

/** 413 with a `keel.payloadTooLarge` `err` body (data `{ limit }`, in bytes), like `denied`; nothing ran. */
export function payloadTooLarge(limit: number): Response {
  const res = jsonResponse(
    413,
    err({ code: "keel.payloadTooLarge", message: `request body exceeds ${limit} bytes`, data: { limit } }),
  );
  res.headers.set("cache-control", "no-store");
  return res;
}
