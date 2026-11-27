import { kernelSet } from "@keel/schema/internal";
import type { ServerStub } from "./ServerStub.ts";

/** Whether `v` is a stub `serverOnly` made in this realm (k.boundary, k.identity), read from the kernel's record. */
export function isStub(v: unknown): v is ServerStub {
  return typeof v === "function" && kernelSet("router.serverOnly").has(v);
}
