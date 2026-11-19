import type { Io } from "@keel/cli";

/**
 * Request headers of a sessions reader command (`ingest`, `monitor`): `accept: application/json` and, with
 * `KEEL_SESSIONS_TOKEN` in `io.env`, the caller cookie `__Host-keel-caller` on https, else `keel-caller`.
 */
export function readerHeaders(io: Io, base: string): Record<string, string> {
  const token = io.env?.KEEL_SESSIONS_TOKEN;
  const cookie = base.startsWith("https:") ? "__Host-keel-caller" : "keel-caller";
  const headers: Record<string, string> = { accept: "application/json" };
  if (token !== undefined && token !== "") headers.cookie = `${cookie}=${token}`;
  return headers;
}
