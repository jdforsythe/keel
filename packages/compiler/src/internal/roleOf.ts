import type { JSXElement } from "oxc-parser";
import { attrOf } from "./attrOf.ts";
import { staticValueOf } from "./staticValueOf.ts";

const BY_TAG: ReadonlyMap<string, string> = new Map(
  Object.entries({
    article: "article",
    aside: "complementary",
    button: "button",
    details: "group",
    dialog: "dialog",
    div: "generic",
    fieldset: "group",
    footer: "contentinfo",
    form: "form",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    header: "banner",
    hr: "separator",
    img: "img",
    li: "listitem",
    main: "main",
    menu: "list",
    meter: "meter",
    nav: "navigation",
    ol: "list",
    option: "option",
    output: "status",
    p: "paragraph",
    progress: "progressbar",
    search: "search",
    section: "region",
    select: "combobox",
    span: "generic",
    table: "table",
    tbody: "rowgroup",
    td: "cell",
    textarea: "textbox",
    tfoot: "rowgroup",
    th: "columnheader",
    thead: "rowgroup",
    tr: "row",
    ul: "list",
  }),
);

const BY_INPUT: ReadonlyMap<string, string | null> = new Map(
  Object.entries({
    button: "button",
    checkbox: "checkbox",
    hidden: null,
    image: "button",
    number: "spinbutton",
    radio: "radio",
    range: "slider",
    reset: "button",
    search: "searchbox",
    submit: "button",
  }),
);

/** Expected ARIA role of an element: explicit `role`, else the implicit role of its tag (best effort). */
export function roleOf(el: JSXElement, tag: string): string | null {
  const explicit = staticValueOf(attrOf(el, "role")?.value ?? null);
  if (explicit !== undefined && !explicit.bare && explicit.text !== "") return explicit.text;
  if (tag === "a") return attrOf(el, "href") === undefined ? "generic" : "link";
  if (tag === "input") {
    const t = staticValueOf(attrOf(el, "type")?.value ?? null);
    const type = t === undefined || t.bare ? "text" : t.text.toLowerCase();
    const r = BY_INPUT.get(type);
    return r === undefined ? "textbox" : r;
  }
  return BY_TAG.get(tag) ?? null;
}
