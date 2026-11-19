import { ServerComment } from "./ServerComment.ts";
import { ServerDocument } from "./ServerDocument.ts";
import { ServerElement } from "./ServerElement.ts";
import { ServerFragment } from "./ServerFragment.ts";
import { ServerInput } from "./ServerInput.ts";
import { ServerNode } from "./ServerNode.ts";
import { ServerOption } from "./ServerOption.ts";
import { ServerSelect } from "./ServerSelect.ts";
import { ServerTemplate } from "./ServerTemplate.ts";
import { ServerText } from "./ServerText.ts";
import { ServerTextArea } from "./ServerTextArea.ts";

/**
 * Give plain Node the DOM globals kernel components build with (`document`, `Node`, `Element`, ...), backed
 * by the DOM-free server tree (k.server, node adapter). Does nothing when a `document` already exists (a
 * browser, happy-dom), so a real DOM is never replaced.
 */
export function installServerDom(): void {
  if (typeof document !== "undefined") return;
  Object.assign(globalThis, {
    document: new ServerDocument(),
    Node: ServerNode,
    Element: ServerElement,
    Text: ServerText,
    Comment: ServerComment,
    DocumentFragment: ServerFragment,
    HTMLTemplateElement: ServerTemplate,
    HTMLElement: ServerElement,
    HTMLInputElement: ServerInput,
    HTMLSelectElement: ServerSelect,
    HTMLTextAreaElement: ServerTextArea,
    HTMLOptionElement: ServerOption,
  });
}
