import { escapeHtml } from "./escapeHtml.ts";

type Values = Readonly<Record<string, string | readonly string[]>>;

/**
 * `values` less every key that `html` renders as the `name` of a `type="password"` input: whether a plain string
 * field is a password is known only once the page has rendered, so the 422 `#k-state` drops it here.
 */
export function withoutPasswords(values: Values, html: string): Values {
  const tags = html.match(/<input [^>]*type="password"[^>]*>/gi)?.join() ?? "";
  return Object.fromEntries(Object.entries(values).filter(([k]) => !tags.includes(` name="${escapeHtml(k)}"`)));
}
