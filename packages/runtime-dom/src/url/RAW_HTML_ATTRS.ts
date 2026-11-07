/** Attributes whose value is parsed as HTML (`srcdoc`): no value is safe (k.compiler: no raw HTML outside `unsafe`). */
export const RAW_HTML_ATTRS: ReadonlySet<string> = new Set(["srcdoc"]);
