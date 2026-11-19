/**
 * Give a claimed server element the text nodes its template has (backlog 0184): HTML has no empty text node, so
 * an empty dynamic text is missing from server HTML and every later `childNodes[i]` would be off by one. Where the
 * template has a text and the server node is not one, an empty text is inserted. Server regions are skipped.
 */
export function alignTexts(tpl: Element, server: Element): void {
  let s = server.firstChild;
  for (const t of tpl.childNodes) {
    let depth = 0;
    while (s !== null && (depth > 0 || (s.nodeType === 8 && s.nodeValue === "["))) {
      if (s.nodeType === 8 && s.nodeValue === "[") depth++;
      else if (s.nodeType === 8 && s.nodeValue === "]") depth--;
      s = s.nextSibling;
    }
    if (t.nodeType === 3 && s?.nodeType !== 3) server.insertBefore(server.ownerDocument.createTextNode(""), s);
    else {
      if (t instanceof Element && s instanceof Element) alignTexts(t, s);
      s = s?.nextSibling ?? null;
    }
  }
}
