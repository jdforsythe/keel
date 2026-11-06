import { contentText } from "./contentText.ts";

/** Text of the `<label>`s naming a form control: `<label for=id>` in its document, or an enclosing label. */
export function labelText(el: Element): string {
  const parts: string[] = [];
  if (el.id !== "")
    for (const label of Array.from(el.ownerDocument.getElementsByTagName("label")))
      if (label.getAttribute("for") === el.id) parts.push(contentText(label));
  const wrap = el.closest("label");
  if (wrap !== null && parts.length === 0) parts.push(contentText(wrap));
  return parts.join(" ").trim();
}
