import type { Finding } from "@keel/check";

/** The one-line message a finding carries in `data`. */
export function msgOf(f: Finding): string {
  return String(f.data?.msg ?? "");
}
