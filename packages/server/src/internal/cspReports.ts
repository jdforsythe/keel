type Report = { readonly document: string; readonly directive: string; readonly blocked: string };

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v : "");
const one = (document: string, directive: string, blocked: string): Report => {
  const word = directive.split(" ")[0] ?? "";
  return { document, directive: /^[a-z-]{1,64}$/.test(word) ? word : "-", blocked };
};

/**
 * The violations in a report body (k.security Reports), as the browsers send them: `application/csp-report`
 * `{ "csp-report": { "document-uri", "effective-directive" | "violated-directive", "blocked-uri" } }`, or
 * `application/reports+json`, an array of `{ type: "csp-violation", body: { documentURL, effectiveDirective, blockedURL } }`
 * (other report types skipped). A directive is its first word, `-` unless it is a directive name of at most 64 characters. Anything else is none.
 */
export function cspReports(body: unknown, modern: boolean): Report[] {
  if (!modern) {
    const r = isRecord(body) ? body["csp-report"] : undefined;
    if (!isRecord(r)) return [];
    const directive = text(r["effective-directive"]) || text(r["violated-directive"]);
    return [one(text(r["document-uri"]), directive, text(r["blocked-uri"]))];
  }
  return (Array.isArray(body) ? body : []).flatMap((e: unknown) => {
    if (!isRecord(e) || e.type !== "csp-violation" || !isRecord(e.body)) return [];
    const b = e.body;
    return [one(text(b.documentURL) || text(e.url), text(b.effectiveDirective), text(b.blockedURL))];
  });
}
