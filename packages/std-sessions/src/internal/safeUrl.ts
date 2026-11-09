import { LOOPBACK } from "@keel/compiler/inspect/LOOPBACK";

/** A token may travel only over https, or to this machine. A non-URL resolves against `x://x` and fails. */
export function safeUrl(url: string): boolean {
  const u = new URL(url, "x://x");
  return u.protocol === "https:" || (u.protocol === "http:" && LOOPBACK.has(u.hostname));
}
