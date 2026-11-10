import type { BuiltClient } from "./BuiltClient.ts";
import { escapeHtml } from "./escapeHtml.ts";

/**
 * The document head's content after the charset and viewport (k.server Document): `<title>` the served deployable's
 * name, a stylesheet link per CSS file of the client build's entry chunk, and the build's `/keel-mark.svg` (Vite
 * copies it from `public/`) as the icon. Every value is escaped; nothing is inline, so a strict CSP allows it all.
 */
export function headHtml(name: string, built: BuiltClient | undefined): string {
  const css = (built?.css ?? []).map((h) => `<link rel="stylesheet" href="${escapeHtml(h)}">`).join("");
  return `<title>${escapeHtml(name)}</title>${css}${built?.files.has("/keel-mark.svg") ? '<link rel="icon" href="/keel-mark.svg">' : ""}`;
}
