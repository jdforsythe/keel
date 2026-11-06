import { err } from "@keel/schema";
import { jsonResponse } from "./jsonResponse.ts";

/** 403 with a `keel.denied` `err` body and `cache-control: no-store` (cross-site write, inspect origin refused). */
export function denied(reason: string): Response {
  const res = jsonResponse(403, err({ code: "keel.denied", message: reason, data: {} }));
  res.headers.set("cache-control", "no-store");
  return res;
}
