import type { ServerStub } from "./ServerStub.ts";
import { records } from "./records.ts";

/** Whether `v` is a stub `serverOnly` made in this realm (k.boundary, k.identity), read from the router's record. */
export function isStub(v: unknown): v is ServerStub {
  return typeof v === "function" && records.serverOnly.has(v);
}
