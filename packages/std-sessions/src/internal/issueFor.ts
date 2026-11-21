import { sessionMarker } from "./sessionMarker.ts";

type Listed = {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly status: string;
};

/**
 * What the issue list says about `fingerprint`. An issue matches by the marker as the first line of its body (the
 * rest of a body holds session text, so a marker further down never matches), or (an issue filed without one) by a title that starts `session <fingerprint>:`. `open`: the first matching open issue, reused. `skip`: no open
 * match, and one match closed as not planned, so nothing is created. `none`: no match, or only matches closed as
 * completed (the bug recurred), so a new issue is created.
 */
export function issueFor(
  issues: readonly Listed[],
  fingerprint: string,
): { readonly kind: "open"; readonly issue: Listed } | { readonly kind: "skip" } | { readonly kind: "none" } {
  const marker = sessionMarker(fingerprint);
  const matches = issues.filter(
    (i) => i.body.split("\n", 1)[0]?.replace(/\r$/, "") === marker || i.title.startsWith(`session ${fingerprint}:`),
  );
  const open = matches.find((i) => i.status === "open");
  if (open !== undefined) return { kind: "open", issue: open };
  return matches.some((i) => i.status === "not_planned") ? { kind: "skip" } : { kind: "none" };
}
