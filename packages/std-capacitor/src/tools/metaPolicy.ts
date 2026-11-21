/** Directives a `<meta http-equiv>` policy ignores (k.shell Build 3). */
const IGNORED = new Set(["frame-ancestors", "report-uri", "report-to", "sandbox"]);

/**
 * `html` with `policy` as a `<meta http-equiv="Content-Security-Policy">` first in `<head>`, without the directives a
 * meta tag ignores: the policy a Capacitor shell's `www/index.html` carries.
 */
export function metaPolicy(html: string, policy: string): string {
  const content = policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "" && !IGNORED.has(d.split(/\s+/)[0] ?? ""))
    .join("; ")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${content}">`;
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  if (head === null) return `${meta}\n${html}`;
  const at = head.index + head[0].length;
  return `${html.slice(0, at)}\n    ${meta}${html.slice(at)}`;
}
