import { clipMessage } from "@keel/schema/internal";

/** A name or id clipped for a diagnostic message (keeps messages under 90 chars). */
export function short(s: string): string {
  return clipMessage(s, 28);
}
