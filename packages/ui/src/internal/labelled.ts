/**
 * Wrap `control` with a visible `<label for>` naming it. The label follows a checkbox and precedes others.
 */
export function labelled(control: Element, id: string, label: string, after: boolean): Node {
  const wrap = document.createElement("div");
  const l = document.createElement("label");
  l.setAttribute("for", id);
  l.appendChild(document.createTextNode(label));
  control.setAttribute("id", id);
  if (after) wrap.append(control, l);
  else wrap.append(l, control);
  return wrap;
}
