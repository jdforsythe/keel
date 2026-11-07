// The URL agreement table (red-team 0084): one set of attributes and literal cases that the runtime
// (test/url-agreement.test.ts) and the compiler (packages/compiler/test/url-agreement.test.ts) both run, so
// the compiler's E1003 and the runtime's about:blank cannot drift apart.

/** Every attribute the runtime guards, with an element that carries it: the URL attributes, then `srcdoc`. */
export const URL_CASE_ATTRS: readonly { readonly tag: string; readonly attr: string }[] = [
  { tag: "a", attr: "href" },
  { tag: "img", attr: "src" },
  { tag: "form", attr: "action" },
  { tag: "button", attr: "formaction" },
  { tag: "a", attr: "xlink:href" },
  { tag: "video", attr: "poster" },
  { tag: "a", attr: "ping" },
  { tag: "object", attr: "data" },
  { tag: "img", attr: "srcset" },
  { tag: "link", attr: "imagesrcset" },
  { tag: "set", attr: "to" },
  { tag: "animate", attr: "from" },
  { tag: "animate", attr: "by" },
  { tag: "animate", attr: "values" },
  { tag: "iframe", attr: "srcdoc" },
];

/**
 * A literal URL: `value` is the string the runtime receives; `jsx`, when present, is how the same string is
 * spelled as a JSX attribute (`name=` omitted), otherwise the compiler test writes `{JSON.stringify(value)}`.
 * `safe` is the verdict for every URL attribute; `srcdoc` rejects every value.
 */
export type UrlCase = { readonly label: string; readonly value: string; readonly jsx?: string; readonly safe: boolean };

export const URL_CASES: readonly UrlCase[] = [
  { label: "javascript:", value: "javascript:alert(1)", safe: false },
  { label: "JAVA<tab>SCRIPT:", value: "JAVA\tSCRIPT:alert(1)", safe: false },
  { label: "data:text/html", value: "data:text/html,<script>alert(1)</script>", safe: false },
  { label: "data:image/png", value: "data:image/png;base64,iVBORw0KGgo=", safe: false },
  { label: "vbscript:", value: "vbscript:msgbox(1)", safe: false },
  { label: "ftp: (not on the allow-list)", value: "ftp://files.example/x", safe: false },
  { label: "leading control chars and space", value: "\u0000\u001f javascript:alert(1)", safe: false },
  { label: "leading newline and tab", value: "\n\tjavascript:alert(1)", safe: false },
  { label: "entity-encoded colon", value: "javascript:alert(1)", jsx: '"javascript&#58;alert(1)"', safe: false },
  {
    label: "JS unicode-escaped colon",
    value: "javascript:alert(1)",
    jsx: '{"javascript\\u003Aalert(1)"}',
    safe: false,
  },
  { label: "fullwidth colon (no scheme)", value: "javascript：alert(1)", safe: true },
  { label: "//evil", value: "//evil.example/x", safe: true },
  { label: "protocol-relative", value: "//cdn.example/a.png", safe: true },
  { label: "relative", value: "/orders/1?tab=items#top", safe: true },
  { label: "https", value: "https://example.com/a", safe: true },
  { label: "mailto", value: "mailto:a@example.com", safe: true },
  { label: "tel", value: "tel:+15551234", safe: true },
];

/** The shared verdict: may `attr` hold `c.value` unchanged? */
export const expectSafe = (attr: string, c: UrlCase): boolean => attr !== "srcdoc" && c.safe;
