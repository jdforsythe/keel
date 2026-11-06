import type { Submission } from "./Submission.ts";
import { escapeHtml } from "./escapeHtml.ts";

/** The no-JS 422 error summary (k.forms): one item per field error, `path: message`, in a `role="alert"`. */
export function fieldSummary(s: Submission): string {
  const items = Object.entries(s.errors)
    .map(([path, message]) => {
      const name = path === "" ? "form" : path;
      return `<li data-field="${escapeHtml(name)}">${escapeHtml(name)}: ${escapeHtml(message)}</li>`;
    })
    .join("");
  return `<div role="alert" data-k-fields="${escapeHtml(s.route)}"><ul>${items}</ul></div>`;
}
