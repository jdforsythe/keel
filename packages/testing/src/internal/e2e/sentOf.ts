import type { SentRequest } from "../../types/SentRequest.ts";

/** A request as k.requests keeps it: method, absolute URL, header names lower case and sorted. */
export function sentOf(method: string, url: string, headers: Iterable<string>): SentRequest {
  return { method, url, headers: [...new Set([...headers].map((h) => h.toLowerCase()))].sort() };
}
