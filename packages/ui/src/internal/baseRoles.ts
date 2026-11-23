import type { BaseRole } from "../types/BaseRole.ts";

/** Each `base` role and the selector its set is written under (k.ui Base), in layer order. */
export const baseRoles: readonly { readonly role: BaseRole; readonly selector: string }[] = [
  { role: "page", selector: "body" },
  { role: "heading", selector: ".k-heading" },
  { role: "link", selector: ".k-link" },
  { role: "button", selector: ".k-button" },
  { role: "control", selector: ".k-control" },
  { role: "label", selector: ".k-label" },
  { role: "fieldError", selector: ".k-error" },
  { role: "summary", selector: ".k-summary" },
];
