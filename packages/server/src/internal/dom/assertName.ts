// ASCII subset of the XML `Name` production, the rule browsers' `createElement` and `setAttribute` enforce with
// `InvalidCharacterError`. An element name starts with a letter (as the HTML tokenizer requires for a start
// tag); an attribute name may also start with `_` or `:`. Non-ASCII is refused: the server DOM never needs it,
// and it keeps every accepted name free of whitespace, quotes, `<`, `>`, `/` and `=` under any definition.
const ELEMENT = /^[A-Za-z][A-Za-z0-9._:-]*$/;
const ATTRIBUTE = /^[A-Za-z_:][A-Za-z0-9._:-]*$/;

/**
 * Return `name` when it is a valid element or attribute name, else throw an `InvalidCharacterError`
 * (k.server: the server DOM never serializes a name that could open a tag or an attribute of its own).
 */
export function assertName(kind: "element" | "attribute", name: string): string {
  if ((kind === "element" ? ELEMENT : ATTRIBUTE).test(name)) return name;
  throw Object.assign(new Error(`k.server: invalid ${kind} name ${JSON.stringify(name).slice(0, 60)}`), {
    name: "InvalidCharacterError",
  });
}
