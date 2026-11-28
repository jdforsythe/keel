import type { Submission } from "./Submission.ts";
import { ServerDocument } from "./dom/ServerDocument.ts";
import { parseHtml } from "./dom/parseHtml.ts";
import { escapeHtml } from "./escapeHtml.ts";

const collapse = (t: string | null): string => (t ?? "").replace(/\s+/g, " ").trim();

/**
 * The no-JS 422 error summary (k.forms), `role="alert"` with the k.ui Base class `k-summary`: one item per field
 * error, then its message. `html` is the rendered route component: an error whose path is the `name` of a control
 * there with an `id` links to it (`#<id>`), named by the text of that control's `<label for>`, else by the path; the
 * root path is named `form` and links nowhere. Labels are read from the page as served, so they are the author's own.
 */
export function fieldSummary(s: Submission, html: string): string {
  const doc = new ServerDocument();
  const page = doc.createDocumentFragment();
  parseHtml(doc, html, page);
  const ids = new Map<string, string>();
  for (const el of page.querySelectorAll("input, select, textarea, button, fieldset")) {
    const name = el.getAttribute("name");
    const id = el.getAttribute("id");
    if (name !== null && id !== null && id !== "" && !ids.has(name)) ids.set(name, id);
  }
  const labels = new Map<string, string>();
  for (const el of page.querySelectorAll("label")) {
    const target = el.getAttribute("for");
    const text = collapse(el.textContent);
    if (target !== null && text !== "" && !labels.has(target)) labels.set(target, text);
  }
  const items = Object.entries(s.errors)
    .map(([path, message]) => {
      const name = path === "" ? "form" : path;
      const id = path === "" ? undefined : ids.get(path);
      const named = escapeHtml((id === undefined ? undefined : labels.get(id)) ?? name);
      const link = id === undefined ? named : `<a href="#${escapeHtml(id)}">${named}</a>`;
      return `<li data-field="${escapeHtml(name)}">${link}: ${escapeHtml(message)}</li>`;
    })
    .join("");
  return `<div role="alert" class="k-summary" data-k-fields="${escapeHtml(s.route)}"><ul>${items}</ul></div>`;
}
