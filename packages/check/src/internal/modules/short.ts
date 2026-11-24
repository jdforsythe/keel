import { clip } from "@keel/compiler/internal";

/** A name or id clipped for a diagnostic message (keeps messages under 90 chars). */
export function short(s: string): string {
  return clip(s, 28);
}
