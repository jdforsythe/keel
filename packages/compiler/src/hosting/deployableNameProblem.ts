/**
 * The problem of deployable name `name`, or undefined when it has the one form (k.topology): lowercase letters,
 * digits and `-`, starting with a letter. A name becomes `dist/<name>/`, `.keel-dev/<name>.storage.json` and
 * `KEEL_PEER_<NAME>`, so in this form no name leaves its folder and no two names meet on a case-insensitive disk or
 * upper-cased. A name with a character outside printable ASCII is printed as a JSON string, so the message is one
 * line.
 */
export function deployableNameProblem(name: string): string | undefined {
  if (/^[a-z][a-z0-9-]*$/.test(name)) return undefined;
  const shown = /^[ -~]*$/.test(name)
    ? name
    : JSON.stringify(name).replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
  return `${shown}: name must be lowercase letters, digits and -, starting with a letter`;
}
