/** Implicit roles of `<input>` by `type`; any other type is `textbox`. */
export const INPUT_ROLES: ReadonlyMap<string, string> = new Map([
  ["button", "button"],
  ["checkbox", "checkbox"],
  ["email", "textbox"],
  ["image", "button"],
  ["number", "spinbutton"],
  ["radio", "radio"],
  ["range", "slider"],
  ["reset", "button"],
  ["search", "searchbox"],
  ["submit", "button"],
  ["hidden", "none"],
]);
