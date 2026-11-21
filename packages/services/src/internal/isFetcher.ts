/** True for an in-process app a `createApp` bound: an object with a `fetch(req)` method. */
export function isFetcher(v: unknown): v is { fetch(req: Request): Promise<Response> } {
  return typeof v === "object" && v !== null && "fetch" in v && typeof v.fetch === "function";
}
