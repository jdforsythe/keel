import { escapeHtml } from "./escapeHtml.ts";

/**
 * The document head's content after the charset and viewport (k.head Server): `<title>` (the matched route's `title`
 * or the served deployable's name), a stylesheet link per `css` URL (the client build's entry chunk CSS, or in dev the
 * deployable's `/@keel/styles.css?d=<name>`), and with `icon` the build's `/keel-mark.svg` (Vite copies it from
 * `public/`). Every value is escaped; nothing is inline, so a strict CSP allows it all.
 */
export function headHtml(name: string, css: readonly string[], icon: boolean): string {
  const links = css.map((h) => `<link rel="stylesheet" href="${escapeHtml(h)}">`).join("");
  return `<title>${escapeHtml(name)}</title>${links}${icon ? '<link rel="icon" href="/keel-mark.svg">' : ""}`;
}
