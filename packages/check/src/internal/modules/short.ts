import { clip } from "../clip.ts";

/** A name or id clipped for a diagnostic message (keeps messages under 90 chars). */
export function short(s: string): string {
  return clip(s, 28);
}
