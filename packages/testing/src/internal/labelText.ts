import { contentText } from "./contentText.ts";

/**
 * Text of the `<label>`s naming a form control, per accname: every `<label for=id>` in its document, in document
 * order, then an enclosing label (unless it is already one of those), joined by a space.
 */
export function labelText(el: Element): string {
  const labels: Element[] = [];
  if (el.id !== "")
    for (const label of Array.from(el.ownerDocument.getElementsByTagName("label")))
      if (label.getAttribute("for") === el.id) labels.push(label);
  const wrap = el.closest("label");
  if (wrap !== null && !labels.includes(wrap)) labels.push(wrap);
  return labels
    .map((l) => contentText(l).trim())
    .filter((t) => t !== "")
    .join(" ");
}
