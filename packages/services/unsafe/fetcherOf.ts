import { unsafe } from "./unsafe.ts";

type Fetcher = { fetch(req: Request): Promise<Response> };

/** A module's entry in the `MODULES_KEY` table as an in-process app when it is an object with a `fetch` function. */
export function fetcherOf(v: unknown): Fetcher | undefined {
  if (typeof v !== "object" || v === null || !("fetch" in v) || typeof v.fetch !== "function") return undefined;
  return unsafe(
    "server bindModules fills the MODULES_KEY table with origins, the keel.user signer and createApp apps, so a module's object entry is an app whose fetch(req) answers a Response",
    () => v as Fetcher,
  );
}
